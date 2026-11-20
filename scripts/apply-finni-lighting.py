"""Theme editor lamps and runtime LED colors without changing light choreography."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def config():
    return json.loads((ROOT/'design/finni-lighting.json').read_text())


def rgb(values):
    return 'RGB(' + ', '.join(str(v) for v in values) + ')'


def script_edits(source):
    theme = config()
    edits = []
    # Limit substitutions to the two palette helpers, never gameplay call sites.
    for routine in ('SetLightColor', 'SetFlashColor'):
        match = re.search(rb'Sub '+routine.encode()+rb'\([^\r\n]*\r\n.*?End Sub', source, re.S)
        if not match:
            raise ValueError(f'Missing lighting helper {routine}')
        before = match[0]
        after = before
        for token, name in theme['source_ids'].items():
            pattern = rb'(        Case '+token.encode()+rb'(?:[^\r\n]*)\r\n)(.*?)(?=        Case |    End Select)'
            color = theme['colors'][name]
            def replace(m):
                body = m[2]
                for prop, values in [('color', [round(v/10) for v in color]), ('colorfull', color)]:
                    if routine == 'SetFlashColor':
                        values = color
                    body = re.sub(rb'(n\.'+prop.encode()+rb' = )RGB\([^\r\n]*\)',
                                  lambda n: n[1]+rgb(values).encode(), body)
                return m[1]+body
            after, count = re.subn(pattern, replace, after, flags=re.S)
            if count != 1:
                raise ValueError(f'Missing lighting color {routine}/{token}')
        edits.append((before, after))
    for before, after in [
        ('RGB(rRed \\ 10, rGreen \\ 10, rBlue \\ 10)', 'FinniShowColor(RGBStep, rRed, rGreen, rBlue, 0.1)'),
        ('RGB(rRed, rGreen, rBlue)', 'FinniShowColor(RGBStep, rRed, rGreen, rBlue, 1)'),
        ('RGB(sRed, sGreen, sBlue)', 'FinniShowColor(sRGBStep, sRed, sGreen, sBlue, 1)'),
        ('RGB(255, 252, 224)', rgb(theme['colors']['ivory'])),
    ]:
        # Warm-white spot resets occur outside the palette helpers.
        if before == 'RGB(255, 252, 224)':
            for spot in ('Spot1', 'Spot2'):
                edits.append(((spot+'.color = '+before).encode(), (spot+'.color = '+after).encode()))
        else:
            edits.append((before.encode(), after.encode()))
    return edits


def show_helper():
    cycle = config()['show_cycle']
    colors = config()['colors']
    lines = ["' Finni party lighting: interpolate the existing six-stage show.",
             'Function FinniShowColor(stage, r, g, b, level)',
             '    Dim t, c0, c1', '    Select Case stage']
    fractions = ['g / 255', '1 - r / 255', 'b / 255', '1 - g / 255', 'r / 255', '1 - b / 255']
    for i, name in enumerate(cycle):
        a = ', '.join(map(str, colors[name]))
        z = ', '.join(map(str, colors[cycle[(i+1) % len(cycle)]]))
        lines += [f'        Case {i}', f'            t = {fractions[i]}',
                  f'            c0 = Array({a})', f'            c1 = Array({z})']
    lines += ['    End Select',
              '    FinniShowColor = RGB(CInt((c0(0) + (c1(0) - c0(0)) * t) * level), CInt((c0(1) + (c1(1) - c0(1)) * t) * level), CInt((c0(2) + (c1(2) - c0(2)) * t) * level))',
              'End Function', '']
    return ('\r\n'.join(lines)+'\r\n').encode()


def lighting_script(source):
    result = source
    for before, after in script_edits(source):
        if before not in result:
            raise ValueError('Unknown source lighting revision')
        result = result.replace(before, after)
    return result + b'\r\n' + show_helper()


def restore_lighting(script, source):
    """Undo only these presentation edits for rule-preservation validation."""
    suffix = b'\r\n' + show_helper()
    if not script.endswith(suffix):
        raise ValueError('Missing Finni lighting helper')
    result = script[:-len(suffix)]
    for before, after in reversed(script_edits(source)):
        result = result.replace(after, before)
    return result


def install(extracted):
    theme = config()
    changed = []
    for kind in ('Light', 'Flasher'):
        for path in sorted((extracted/'gameitems').glob(kind+'.*.json')):
            data = json.loads(path.read_text())
            obj = data[kind]
            if obj.get('is_backglass', False):
                continue
            updated = False
            for prop in ('color', 'color2'):
                name = theme['static_colors'].get(obj.get(prop, '').lower())
                if name:
                    values = theme['colors'][name]
                    if kind == 'Light' and prop == 'color':
                        values = [round(v/10) for v in values]
                    obj[prop] = '#' + ''.join(f'{v:02x}' for v in values)
                    updated = True
            if updated:
                path.write_text(json.dumps(data, indent=2))
                changed.append(obj['name'])
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', type=Path, default=ROOT/'.work/finni-live-extracted')
    args = parser.parse_args()
    print('Themed lamps:', len(install(args.install)))
