"""Checked presentation-only substitutions for the seven approved party chores."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def task_script(source):
    modes = json.loads((ROOT/'design/party-tasks.json').read_text(encoding='utf-8'))['modes']
    for mode in modes:
        key = mode['key'].encode('ascii')
        # Match only the three existing DMD events; retain effects, duration,
        # queue flags and existing voice IDs. No new game events or rules.
        events = [
            (rb'DMD "[^"\r\n]*", tmp, "d_' + key + rb'"([^\r\n]*"vo_' + key + rb'")',
             'CL(0, "'+mode['dmd']+'"), tmp'),
            (rb'DMD "[^"\r\n]*", "[^"\r\n]*", "d_' + key + rb'"([^\r\n]*"vo_(?:shoot[^"\r\n]+)")',
             'CL(0, "'+mode['instruction'][0]+'"), CL(1, "'+mode['instruction'][1]+'")'),
            (rb'DMD "[^"\r\n]*", "[^"\r\n]*", "d_' + key + rb'"([^\r\n]*"vo_' + key + rb'defeated")',
             'CL(0, "'+mode['complete'][0]+'"), CL(1, "'+mode['complete'][1]+'")'),
        ]
        for pattern, payload in events:
            replacement = b'DMD ' + payload.encode('ascii') + b', "bkborder"'
            source, count = re.subn(pattern, lambda m: replacement + m[1], source)
            if count != 1:
                raise ValueError(f'Expected one {mode["source"]} DMD event, found {count}')
        # Active-scoreboard backgrounds must not bring back villain portraits.
        source = source.replace(b'"d_'+key+b'"', b'"bkborder"')
    baking=next(m for m in modes if m['key']=='megalodon')
    cue=('CL(0, "'+baking['instruction'][0]+'"), CL(1, "'+baking['instruction'][1]+'"), "bkborder", eNone, eNone, eNone, 3000, True, ').encode('ascii')
    assert source.count(cue+b'"vo_shootflashingshots"')==1
    source = source.replace(cue+b'"vo_shootflashingshots"',cue+b'"vo_shootblueshots-megalodon"',1)
    return source
