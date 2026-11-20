"""Apply approved scoop, lock-ramp, presentation, lighting and task-selection changes."""
import argparse
import json
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ORIGINAL=b'HellHouse.kick 164, 30, 1'
BALL_SAVED = b'DMD "_", CL(1, "BALL SAVED"), "_", eNone, eBlinkfast, eNone, 1000, True, ""'
BALL_SAVED_VOICE = BALL_SAVED[:-2] + b'"vo_ballsaved"'


def tuned_script(source, motion=True):
    tuning=json.loads((ROOT/'design/gameplay-tuning.json').read_text())['scoop']
    if source.count(ORIGINAL)!=1:
        raise ValueError('Expected exactly one original HellHouse kick; refusing an unknown source revision.')
    values=[tuning[key] for key in ('angle','speed','inclination')]
    replacement=('HellHouse.kick '+', '.join(format(value,'g') for value in values)).encode('ascii')
    tuned = source.replace(ORIGINAL,replacement,1)
    if tuned.count(BALL_SAVED) != 1:
        raise ValueError('Expected exactly one original ball-save display.')
    tuned = tuned.replace(BALL_SAVED, BALL_SAVED_VOICE, 1)
    story = runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script'](tuned)
    tasks = runpy.run_path(str(ROOT/'scripts/apply-party-tasks.py'))['task_script'](story)
    display = runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['dmd_script'](tasks)
    if motion:
        display = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['animate_script'](display)
    lighting = runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['lighting_script'](display)
    selected = runpy.run_path(str(ROOT/'scripts/apply-party-selection.py'))['selection_script'](lighting)
    return runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['ramp_script'](selected)


def install(extracted):
    source=(ROOT/'.work/deadpool-extracted/script.vbs').read_bytes()
    path=extracted/'script.vbs'
    expected=tuned_script(source)
    # Preserve the prior presentation build as a recognized upgrade input.
    prior_selection = runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['lighting_script'](
        runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['dmd_script'](
            runpy.run_path(str(ROOT/'scripts/apply-party-tasks.py'))['task_script'](
                runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script'](
                    source.replace(ORIGINAL,b'HellHouse.kick 164, 12, 0',1).replace(BALL_SAVED,BALL_SAVED_VOICE,1)))))
    previous_lighting = runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['restore_lighting'](expected, source)
    # Accept the previously built scoop-only revision as an upgrade input.
    previous = source.replace(ORIGINAL,b'HellHouse.kick 164, 12, 0',1)
    previous_story = expected.replace(b'case 5:PlaySong "mu_hellhouse5"', b'case 5:PlaySong "mu_multiball"',1)
    previous_without_save_voice = expected.replace(BALL_SAVED_VOICE, BALL_SAVED, 1)
    old_tasks = runpy.run_path(str(ROOT/'scripts/apply-party-tasks.py'))['task_script'](
        runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script'](
            source.replace(ORIGINAL,b'HellHouse.kick 164, 12, 0',1).replace(BALL_SAVED,BALL_SAVED_VOICE,1)))
    previous_dmd = expected.replace(b'TARGETS + LIT SHOTS', b'TARGETS / LIT SHOTS',1)
    first_pass=runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['first_pass_script'](old_tasks)
    without_motion = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_motion'](expected)
    prior_motion = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_motion'](path.read_bytes())
    prior_friendship = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_friendship_events'](without_motion)
    prior_cake_task = expected.replace(b'COOKIES BAKED',b'CAKE BAKED').replace(b'COOKIE SUPER JACKPOT',b'BAKING SUPER JACKPOT').replace(b'COOKIE JACKPOT',b'BAKING JACKPOT')
    prior_ramp = runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['restore_script'](expected)
    current_without_ramp = runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['restore_script'](path.read_bytes())
    if current_without_ramp != prior_ramp and path.read_bytes() not in (source,previous,previous_story,previous_without_save_voice,old_tasks,previous_dmd,first_pass,previous_lighting,prior_selection,expected,without_motion,prior_cake_task,prior_ramp) and prior_motion not in (tuned_script(source,motion=False),prior_friendship):
        raise ValueError('Working script has unrelated edits; refusing to overwrite them.')
    path.write_bytes(expected)
    return expected


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',type=Path,default=ROOT/'.work/finni-live-extracted')
    args=parser.parse_args();install(args.install)
    print('Applied scoop, modest lock-ramp tuning, presentation, lighting and task selection.')
