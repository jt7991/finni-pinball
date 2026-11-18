"""Apply approved scoop, multiball presentation and title-music changes; preserve other script bytes."""
import argparse
import json
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ORIGINAL=b'HellHouse.kick 164, 30, 1'


def tuned_script(source):
    tuning=json.loads((ROOT/'design/gameplay-tuning.json').read_text())['scoop']
    if source.count(ORIGINAL)!=1:
        raise ValueError('Expected exactly one original HellHouse kick; refusing an unknown source revision.')
    values=[tuning[key] for key in ('angle','speed','inclination')]
    replacement=('HellHouse.kick '+', '.join(format(value,'g') for value in values)).encode('ascii')
    tuned = source.replace(ORIGINAL,replacement,1)
    return runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script'](tuned)


def install(extracted):
    source=(ROOT/'.work/deadpool-extracted/script.vbs').read_bytes()
    path=extracted/'script.vbs'
    expected=tuned_script(source)
    # Accept the previously built scoop-only revision as an upgrade input.
    previous = source.replace(ORIGINAL,b'HellHouse.kick 164, 12, 0',1)
    previous_story = expected.replace(b'case 5:PlaySong "mu_hellhouse5"', b'case 5:PlaySong "mu_multiball"',1)
    if path.read_bytes() not in (source,previous,previous_story,expected):
        raise ValueError('Working script has unrelated edits; refusing to overwrite them.')
    path.write_bytes(expected)
    return expected


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',type=Path,default=ROOT/'.work/finni-live-extracted')
    args=parser.parse_args();install(args.install)
    print('Applied scoop feed and Cake Time / Friendship presentation. Other script bytes preserved.')
