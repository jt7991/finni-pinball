"""Route the soundtrack by game phase and mode without changing game rules."""
import argparse
from pathlib import Path

# Exact anchors deliberately reject unrelated table-script revisions.
def _vbs(text):
    return text.replace('\n', '\r\n').encode('ascii')


PRIOR_REPLACEMENTS = [
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

REPLACEMENTS = PRIOR_REPLACEMENTS + [
    (_vbs("""    StartAttractMode
End Sub"""),
     _vbs("""    StartAttractMode
    Debug.Print "FINNI_MUSIC_READY"
End Sub""")),
    (_vbs("""Dim Song
Song = ""

Sub PlaySong(name)
    ' Task selection and saved-ball launches must not interrupt multiballs.
    If name = "mu_shooterlane" Then
        If FinniMultiballSong() <> "" Then name = FinniMultiballSong()
    End If
    If bMusicOn Then
        If Song <> name Then
            StopSound Song
            Song = name
            PlaySound Song, -1, SongVolume
        End If
    End If
End Sub"""),
     _vbs("""Dim Song, FinniSongVolume, FinniMusicPaused, FinniBrowserMusic
Song = ""

Sub FinniUseBrowserMusic()
    If Song <> "" Then StopSound Song
    FinniBrowserMusic = True
    FinniSendMusic
End Sub

Sub FinniSendMusic()
    Debug.Print "FINNI_MUSIC|" & Song & "|" & Replace(CStr(CDbl(SongVolume)), ",", ".")
End Sub

Sub PlaySong(ByVal name)
    If Not bMusicOn Then name = ""
    If Song = name And FinniSongVolume = SongVolume Then Exit Sub
    If Not FinniBrowserMusic And Song <> name And Song <> "" Then StopSound Song
    Song = name
    FinniSongVolume = SongVolume
    If FinniBrowserMusic Then
        FinniSendMusic
    ElseIf Song <> "" Then
        PlaySound Song, -1, SongVolume, 0, 0, 0, 1, 0
    End If
End Sub""")),
    (_vbs("""Sub ChangeSong
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
            Else 'play the regular-play track on every ball
                PlaySong "mu_hellhouse1"
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

Sub RandomTitleTrack
    dim b
    b = RndNbr(5)
    Select Case b
        Case 1:PlaySong "mu_gameover"
        case 2:PlaySong "mu_SexyMF"
        case 3:PlaySong "mu_XforceSM"
        case 4:PlaySong "mu_boom-dp-rap"
        case 5:PlaySong "mu_hellhouse5"
    End Select
End Sub"""),
     _vbs("""Sub ChangeSong
    Dim track
    track = ""
    If bGameInPlay And Not FinniMusicPaused Then
        track = FinniMultiballSong()
        If track = "" Then
            If Battle(CurrentPlayer, 0) > 0 Then
                track = "mu_juggernaut" 'All seven tasks share a single track.
            ElseIf bDiscoMBEnabled Then
                track = "mu_discomb"
            ElseIf bDiscoLoopsEnabled Then
                track = "mu_discoloops"
            Else
                track = "mu_hellhouse1"
            End If
        End If
    End If
    PlaySong track
End Sub""")),
    (_vbs("""    ' you may wish to start some music, play a sound, do whatever at this point"""),
     _vbs("""    FinniMusicPaused = False
    ChangeSong""")),
    (_vbs("""    If NOT Tilted Then
        PLaySong "mu_bonuscount"
        'Count the bonus."""),
     _vbs("""    FinniMusicPaused = True
    ChangeSong
    If NOT Tilted Then
        'Count the bonus.""")),
    (_vbs("""        PlaySong "mu_shooterlane"
        UpdateSkillshot()"""),
     _vbs("""        FinniMusicPaused = False
        ChangeSong
        UpdateSkillshot()""")),
    (_vbs("""    ShowTableInfo
    RandomTitleTrack"""),
     _vbs("""    ShowTableInfo
    ChangeSong""")),
    (_vbs("""        bBattleReady = False
        PlaySong "mu_shooterlane"
        Exit Sub"""),
     _vbs("""        bBattleReady = False
        Exit Sub""")),
    (_vbs("""    SongVolume = Table1.Option("Music Volume", 0, 1, 0.1, 0.2, 0)
    If bMusicOn Then
        ChangeSong
    Else
        StopSound Song
        Song = ""
    End If"""),
     _vbs("""    SongVolume = Table1.Option("Music Volume", 0, 1, 0.1, 0.2, 0)
    ChangeSong""")),
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
