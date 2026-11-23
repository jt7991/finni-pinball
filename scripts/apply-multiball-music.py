"""Give active multiballs reliable music ownership without changing game rules."""
import argparse
from pathlib import Path

# Exact anchors deliberately reject unrelated table-script revisions.
def _vbs(text):
    return text.replace('\n', '\r\n').encode('ascii')


REPLACEMENTS = [
    (_vbs("""Sub ChangeSong
    Dim a
    Select Case Battle(CurrentPlayer, 0)
        Case 0 'no battle active so play the standard songs or the multiball songs
            If bBerserker Then
                PLaySong "mu_beserkerrage"
            ElseIf bDiscoLoopsEnabled Then
                PlaySong "mu_discoloops"
            ElseIf bDiscoMBEnabled Then
                PlaySong "mu_discomb"
            ElseIf bMechSuitMBStarted Then
                PlaySong "mu_mechsuitmb"
            ElseIf bNinjaMB Then
                PlaySong "mu_ninjamb"
            ElseIf bLilDPMB Then
                PlaySong "mu_multiball"
            Else 'play default music
                PlaySong "mu_hellhouse" &Balls
            End If
        Case 1 'Juggernaut
            PlaySong "mu_juggernaut"
        Case 2 'Mystique
            PlaySong "mu_mystique"
        Case 3 'Sabretooth
            PlaySong "mu_sabretooth"
        Case 4 'T-Rex
            PlaySong "mu_trex"
        Case 5 'Megalodon
            PlaySong "mu_megalodon"
        Case 6 'Sauron
            PlaySong "mu_sauronmb"
        Case 7 'MrSinister
            PlaySong "mu_mrsinister"
    End Select
End Sub

"""),
     _vbs("""
' Fixed soundtrack priority: three-lock Friendship, Cake Time, then tasks.
Function FinniMultiballSong()
    FinniMultiballSong = ""
    If bNinjaMB Then
        FinniMultiballSong = "mu_ninjamb"
    ElseIf bLilDPMB Then
        FinniMultiballSong = "mu_multiball"
    End If
End Function

Sub ChangeSong
    Dim a
    a = FinniMultiballSong()
    If a <> "" Then
        PlaySong a
        Exit Sub
    End If
    Select Case Battle(CurrentPlayer, 0)
        Case 0 'no battle active so play the standard songs or the multiball songs
            If bDiscoMBEnabled Then
                PlaySong "mu_discomb"
            ElseIf bDiscoLoopsEnabled Then
                PlaySong "mu_discoloops"
            ElseIf bMechSuitMBStarted Then
                PlaySong "mu_mechsuitmb"
            ElseIf bBerserker Then
                PlaySong "mu_beserkerrage"
            Else 'play default music
                PlaySong "mu_hellhouse" &Balls
            End If
        Case 1 'Juggernaut
            PlaySong "mu_juggernaut"
        Case 2 'Mystique
            PlaySong "mu_mystique"
        Case 3 'Sabretooth
            PlaySong "mu_sabretooth"
        Case 4 'T-Rex
            PlaySong "mu_trex"
        Case 5 'Megalodon
            PlaySong "mu_megalodon"
        Case 6 'Sauron
            PlaySong "mu_sauronmb"
        Case 7 'MrSinister
            PlaySong "mu_mrsinister"
    End Select
End Sub

""")),
    (_vbs("""            Else 'play default music
                PlaySong "mu_hellhouse" &Balls
"""),
     _vbs("""            Else 'play the regular-play track on every ball
                PlaySong "mu_hellhouse1"
""")),
    (_vbs("""    bLilDPMB = False
    LilDPTimer.Enabled = 0"""),
     _vbs("""    bLilDPMB = False
    ChangeSong
    LilDPTimer.Enabled = 0""")),
    (_vbs("""Sub PlaySong(name)
"""),
     _vbs("""Sub PlaySong(name)
    ' Task selection and saved-ball launches must not interrupt multiballs.
    If name = "mu_shooterlane" Then
        If FinniMultiballSong() <> "" Then name = FinniMultiballSong()
    End If
""")),
    (_vbs("""    Else
        StopSound Song
    End If"""),
     _vbs("""    Else
        StopSound Song
        Song = ""
    End If""")),
]


def music_script(source):
    source = restore_music(source)
    for before, after in REPLACEMENTS:
        if source.count(before) != 1:
            raise ValueError('Unknown music script revision: ' + repr(before[:60]))
        source = source.replace(before, after, 1)
    return source


def restore_music(source):
    for before, after in reversed(REPLACEMENTS):
        source = source.replace(after, before)
    return source


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('script', type=Path)
    args = parser.parse_args()
    args.script.write_bytes(music_script(args.script.read_bytes()))
