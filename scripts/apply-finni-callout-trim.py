"""Remove random chatter and the attract-mode credit card from the Finni table script."""
import argparse
from pathlib import Path
import re

ATTRACT_CREDIT = rb'^    DMD "", "", "d_jppresents", eNone, eNone, eNone, 3000, False, ""\r?\n'


def remove_attract_credit(script):
    script, count = re.subn(ATTRACT_CREDIT, b'', script, flags=re.M)
    if count != 1:
        raise ValueError('Expected one attract-mode credit card in the table script.')
    return script


def trim_script(source):
    script = source
    for pattern in (
        rb"^'\*+\r?\n' Play random quotes\r?\n'\*+\r?\n\r?\nSub PlayQuote\r?\n.*?^End Sub\r?\n\r?\n",
        rb"^Sub Trigger016_Hit 'just a quote trigger\r?\n    Playquote\r?\nEnd Sub\r?\n\r?\n",
    ):
        script, count = re.subn(pattern, b'', script, flags=re.M | re.S)
        if count != 1:
            raise ValueError(f'Expected one random chatter block matching {pattern!r}, found {count}.')
    return remove_attract_credit(script)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.write_bytes(trim_script(args.source.read_bytes()))
