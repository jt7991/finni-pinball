"""Skip finished tasks in the native chooser, retaining per-player progress."""


def selection_script(source):
    changes = [
        (b'AND LifeLeft(CurrentPlayer, Battlenr)> 0 Then',
         b'AND LifeLeft(CurrentPlayer, Battlenr)> 0 AND Battle(CurrentPlayer, Battlenr) <> 1 Then'),
        (b'        Battlenr = (Battlenr - 1)\r\n        If Battlenr <1 Then Battlenr = BattlesToChoose',
         b'        NextPartyTask -1'),
        (b'        Battlenr = (Battlenr + 1)\r\n        If Battlenr> BattlesToChoose Then Battlenr = 1',
         b'        NextPartyTask 1'),
        (b'Sub UpdateDMDBattle\r\n    Dim tmp',
         b'Sub UpdateDMDBattle\r\n    Dim tmp\r\n'
         b'    If Battle(CurrentPlayer, Battlenr) = 1 OR LifeLeft(CurrentPlayer, Battlenr) <= 0 Then NextPartyTask 1'),
    ]
    for old, new in changes:
        if source.count(old) != 1:
            raise ValueError('Unknown party selection source; expected one occurrence: ' + repr(old))
        source = source.replace(old, new, 1)
    helper = b'''Sub NextPartyTask(direction)
    Dim attempts
    For attempts = 1 To BattlesToChoose
        Battlenr = Battlenr + direction
        If Battlenr < 1 Then Battlenr = BattlesToChoose
        If Battlenr > BattlesToChoose Then Battlenr = 1
        If Battle(CurrentPlayer, Battlenr) <> 1 AND LifeLeft(CurrentPlayer, Battlenr) > 0 Then Exit Sub
    Next
End Sub

'''.replace(b'\n', b'\r\n')
    return source.replace(b'Sub ChooseBattle(keycode)', helper + b'Sub ChooseBattle(keycode)', 1)
