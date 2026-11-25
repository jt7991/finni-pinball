"""Remove random chatter from the Finni table script."""
import argparse
from pathlib import Path
import re


def trim_script(source):
    script = source
    for pattern in (
        rb"^'\*+\r?\n' Play random quotes\r?\n'\*+\r?\n\r?\nSub PlayQuote\r?\n.*?^End Sub\r?\n\r?\n",
        rb"^Sub Trigger016_Hit 'just a quote trigger\r?\n    Playquote\r?\nEnd Sub\r?\n\r?\n",
    ):
        script, count = re.subn(pattern, b'', script, flags=re.M | re.S)
        if count != 1:
            raise ValueError(f'Expected one random chatter block matching {pattern!r}, found {count}.')
    return script


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.write_bytes(trim_script(args.source.read_bytes()))
