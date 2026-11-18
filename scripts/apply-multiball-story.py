"""Apply Cake Time / Friendship cues and the title-only music redirect to the known JP script.

Every replacement is checked against the source revision. Scoring, qualification,
shot flags, timers, ball handling and toy animation are deliberately untouched.
"""


def story_script(source):
    replacements = [
        # The fifth title selection shares Cake Time's source track. Redirect
        # only this selection, retaining the in-game multiball music.
        (b'case 5:PlaySong "mu_multiball"', b'case 5:PlaySong "mu_hellhouse5"', 1),
        (b'"LILDP JACKPOT"', b'"CAKE JACKPOT"', 4),
        (b'"d_lildpmb"', b'"bkborder"', 2),
        (b'"       LIL DEADPOOL "', b'CL(0, "CAKE TIME")', 1),
        (b'"         MULTIBALL  "', b'CL(1, "MULTIBALL")', 1),
        (b'"NINJA MB JACKPOT"', b'"FRIENDSHIP JP"', 1),
        (b'DMD CL(0, "NINJA"), CL(1, "MULTIBALL"), "", eNone, eNone, eNone, 1500, True, "vo_multiball"',
         b'DMD CL(0, "FRIENDSHIP"), CL(1, "MULTIBALL"), "", eNone, eNone, eNone, 1500, True, "vo_friendshipmb"', 1),
        (b'DMD "", "", "d_lock1"', b'DMD CL(0, "ONE FRIEND"), CL(1, "READY"), "bkborder"', 1),
        (b'DMD "", "", "d_lock2"', b'DMD CL(0, "TWO FRIENDS"), CL(1, "READY"), "bkborder"', 1),
        (b'DMD "", "", "d_lock3"', b'DMD CL(0, "THREE FRIENDS"), CL(1, "READY"), "bkborder"', 1),
        (b'DMD "", "", "d_lockislit"', b'DMD CL(0, "GATHER FRIENDS"), CL(1, "RIGHT RAMP"), "bkborder"', 2),
        (b'CL(0, "BALLS LOCKED")', b'CL(0, "FRIENDS READY")', 1),
    ]
    for old_title, old_image, title, effect in [
        ('  DAZZLER', 'd_dazzler', 'KITCHEN TIMER', 'EXTRA TIME'),
        (' COLOSSUS', 'd_colossus', 'PARTY LIGHTS', '2X TASK POINTS'),
        (' WOLVERINE', 'd_wolverine', 'CHECKLIST', '2X TASK PROGRESS'),
        (' DOMINO', 'd_domino', 'PARTY FAVORS', 'BONUS POINTS'),
    ]:
        old=f'DMD "{old_title}", "  TEAM-UP", "{old_image}"'.encode('ascii')
        new=f'DMD CL(0, "{title}"), CL(1, "{effect}"), "bkborder"'.encode('ascii')
        replacements.append((old,new,1))
    # Phase cues are queued after the existing jackpot display. Only DMD/audio
    # statements are added; all original gameplay statements remain byte-for-byte.
    for anchor, line in [
        (b'For x = 1 to 6:LilDPLights(x) = 2:Next',
         b'DMD CL(0, "CAKE TOPPINGS"), CL(1, "SHOOT LIT SHOTS"), "bkborder", eNone, eNone, eNone, 1800, False, "vo_caketimetoppings"'),
        (b'LilDPSpinner.Enabled = 1',
         b'DMD CL(0, "FINAL FLOURISH"), CL(1, "SHOOT SPINNERS"), "bkborder", eNone, eNone, eNone, 1800, False, "vo_caketimefinish"'),
        (b'AddPlayFieldMultiplier 1\r\n        Case Else',
         b'DMD CL(0, "MORE FROSTING"), CL(1, "SHOOT FINNI"), "bkborder", eNone, eNone, eNone, 1800, False, "vo_caketimefrosting"'),
    ]:
        if anchor.startswith(b'AddPlayFieldMultiplier'):
            replacement = anchor.replace(b'\r\n        Case Else', b'\r\n            '+line+b'\r\n        Case Else')
        else:
            replacement = anchor+b'\r\n            '+line
        replacements.append((anchor, replacement, 1))
    for old, new, count in replacements:
        actual = source.count(old)
        if actual != count:
            raise ValueError(f'Expected {count} occurrences of {old!r}; found {actual}')
        source = source.replace(old, new)
    return source
