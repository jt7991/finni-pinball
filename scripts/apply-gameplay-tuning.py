"""Apply the Finni scoop, lock-ramp, presentation, lighting, audio and task-selection changes."""
import argparse
import json
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ORIGINAL=b'HellHouse.kick 164, 30, 1'
BALL_SAVED = b'DMD "_", CL(1, "BALL SAVED"), "_", eNone, eBlinkfast, eNone, 1000, True, ""'
BALL_SAVED_VOICE = BALL_SAVED[:-2] + b'"vo_ballsaved"'
TILT_CHANGES = (
    (b'If keycode = MechanicalTilt Then Tilt = 16:CheckTilt',
     b'If keycode = MechanicalTilt And TiltSensitivity > 0 Then Tilt = 16:CheckTilt'),
    (b'    Tilt = Tilt + TiltSensitivity',
     b'    If TiltSensitivity <= 0 Then Exit Sub\r\n    Tilt = Tilt + TiltSensitivity'),
)


def tilt_script(source):
    source = restore_tilt(source)
    for before, after in TILT_CHANGES:
        if source.count(before) != 1:
            raise ValueError('Expected one original tilt handler statement.')
        source = source.replace(before, after, 1)
    return source


def restore_tilt(source):
    for before, after in TILT_CHANGES:
        source = source.replace(after, before)
    return source


def tuned_script(source, motion=True, music=True, trim_callouts=True):
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
    ramp = tilt_script(runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['ramp_script'](selected))
    tuned = runpy.run_path(str(ROOT/'scripts/apply-multiball-music.py'))['music_script'](ramp) if music else ramp
    if trim_callouts:
        tuned = runpy.run_path(str(ROOT/'scripts/apply-finni-callout-trim.py'))['trim_script'](tuned)
    return tuned


def install(extracted):
    source=(ROOT/'.work/deadpool-extracted/script.vbs').read_bytes()
    path=extracted/'script.vbs'
    result = tuned_script(source)
    existing = path.read_bytes()
    if existing == result:
        return result
    music = runpy.run_path(str(ROOT/'scripts/apply-multiball-music.py'))
    current = restore_tilt(music['restore_music'](existing))
    expected=restore_tilt(tuned_script(source, music=False, trim_callouts=False))
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
    previous_callouts = runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['mode_callouts'](expected, restore=True)
    previous_without_save_voice = expected.replace(BALL_SAVED_VOICE, BALL_SAVED, 1)
    old_tasks = runpy.run_path(str(ROOT/'scripts/apply-party-tasks.py'))['task_script'](
        runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script'](
            source.replace(ORIGINAL,b'HellHouse.kick 164, 12, 0',1).replace(BALL_SAVED,BALL_SAVED_VOICE,1)))
    previous_dmd = expected.replace(b'TARGETS + LIT SHOTS', b'TARGETS / LIT SHOTS',1)
    first_pass=runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['first_pass_script'](old_tasks)
    without_motion = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_motion'](expected)
    prior_motion = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_motion'](current)
    prior_friendship = runpy.run_path(str(ROOT/'scripts/finni-dmd-native-motion.py'))['restore_friendship_events'](without_motion)
    prior_cake_task = expected.replace(b'COOKIES BAKED',b'CAKE BAKED').replace(b'COOKIE SUPER JACKPOT',b'BAKING SUPER JACKPOT').replace(b'COOKIE JACKPOT',b'BAKING JACKPOT')
    prior_ramp = runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['restore_script'](expected)
    current_without_ramp = runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))['restore_script'](current)
    if current_without_ramp != prior_ramp and current not in (source,previous,previous_story,previous_callouts,previous_without_save_voice,old_tasks,previous_dmd,first_pass,previous_lighting,prior_selection,expected,without_motion,prior_cake_task,prior_ramp) and prior_motion not in (restore_tilt(tuned_script(source,motion=False,music=False,trim_callouts=False)),prior_friendship):
        raise ValueError('Working script has unrelated edits; refusing to overwrite them.')
    path.write_bytes(result)
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',type=Path,default=ROOT/'.work/finni-live-extracted')
    args=parser.parse_args();install(args.install)
    print('Applied scoop, Friendship ramp tuning, presentation, lighting and task selection.')
