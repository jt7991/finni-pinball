"""Give aligned climbing shots a local speed floor at the lock-ramp entrance."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CALL = b'        FinniLockRampAssist BOT(b)\r\n'
MARKER = b"\r\n' Finni lock-ramp entrance assist\r\n"
END = b"' End Finni lock-ramp entrance assist\r\n"


def restore_script(source):
    return re.sub(re.escape(MARKER) + rb'.*?' + re.escape(END), b'', source, flags=re.S).replace(CALL, b'')


def ramp_script(source):
    source = restore_script(source)
    tuning = json.loads((ROOT/'design/gameplay-tuning.json').read_text())['lock_ramp']
    anchor = b'    For b = lob to UBound(BOT)\r\n'
    if source.count(anchor) != 1:
        raise ValueError('Expected the original rolling timer ball loop')
    routine = f'''Sub FinniLockRampAssist(ball)
    Dim speed, factor
    ' Only the rising entrance of Ramp010; preserve aim and leave rollbacks alone.
    If ball.X <240 Or ball.X >292 Or ball.Y <290 Or ball.Y >334 Then Exit Sub
    If ball.Z <29 Or ball.Z >60 Then Exit Sub
    If Abs(ball.Y - (0.75 * (ball.X - 293) + 331)) >20 Then Exit Sub
    If ball.VelX >=0 Or ball.VelY >=0 Then Exit Sub
    speed = Sqr(ball.VelX ^2 + ball.VelY ^2)
    If speed <{tuning['minimum_entry_speed']} Or speed >={tuning['climb_speed']} Then Exit Sub
    If (-0.8 * ball.VelX - 0.6 * ball.VelY) / speed <0.94 Then Exit Sub
    factor = {tuning['climb_speed']} / speed
    ball.VelX = ball.VelX * factor
    ball.VelY = ball.VelY * factor
End Sub
'''.replace('\n', '\r\n').encode('ascii')
    result = source.replace(anchor, anchor + CALL, 1)
    return result.replace(b'Sub RollingTimer_Timer()', MARKER + routine + END + b'Sub RollingTimer_Timer()', 1)
