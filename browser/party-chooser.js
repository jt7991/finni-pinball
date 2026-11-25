// Shared player correction for both engines. The authored table and historical
// reference inputs stay intact; install once after table initialization.
export const partyChooserScript = `Dim FinniChooserGeneration, FinniChooserShown, FinniChooserLife
FinniChooserGeneration=0:FinniChooserShown=0:FinniChooserLife=-1

Sub StartChooseBattle
    If Battle(CurrentPlayer, 0) <> 0 Then
        If BallsInHole > 0 Then
            Flashforms li070, 1500, 50, 0
            vpmtimer.addtimer 1500, "kickBallOut '"
        End If
        Exit Sub
    End If
    If NOT bChooseBattle Then
        FinniChooserGeneration=FinniChooserGeneration+1
        FinniChooserShown=0:FinniChooserLife=-1
        DMD "", CL(1, "FLIPPERS TO CHOOSE"), "d_finni_choose", eNone, eNone, eNone, 2000, True, "vo_chooseyourbattle"
        bChooseBattle = True
        If BattlesWon(CurrentPlayer)> 2 Then BattlesToChoose = 6
        If BattlesWon(CurrentPlayer)> 5 Then BattlesToChoose = 7
        vpmtimer.addtimer 2000, "FinniChooserDeferred " & CStr(FinniChooserGeneration) & " '"
    End If
End Sub

Sub FinniChooserDeferred(generation)
    If NOT bChooseBattle Then Exit Sub
    If generation <> FinniChooserGeneration Then Exit Sub
    If FinniChooserShown <> 0 Then Exit Sub
    UpdateDMDBattle
End Sub

Sub UpdateDMDBattle
    Dim tmp
    If NOT bChooseBattle Then Exit Sub
    If Battle(CurrentPlayer, 0) <> 0 Then Exit Sub
    If Battle(CurrentPlayer, Battlenr) = 1 OR LifeLeft(CurrentPlayer, Battlenr) <= 0 Then NextPartyTask 1
    If FinniChooserShown = Battlenr AND FinniChooserLife = LifeLeft(CurrentPlayer, Battlenr) Then Exit Sub
    FinniChooserShown=Battlenr:FinniChooserLife=LifeLeft(CurrentPlayer, Battlenr)
    tmp = ShowLife(LifeLeft(CurrentPlayer, Battlenr) )
    Select Case Battlenr
        Case 1:DMDFlush:DMD "", RL(1, tmp), "d_finni_presents_select", eNone, eNone, eNone, 10000, True, "vo_juggernaut"
        case 2:DMDFlush:DMD "", RL(1, tmp), "d_finni_invitations_select", eNone, eNone, eNone, 10000, True, "vo_mystique"
        Case 3:DMDFlush:DMD "", RL(1, tmp), "d_finni_balloons_select", eNone, eNone, eNone, 10000, True, "vo_sabretooth"
        Case 4:DMDFlush:DMD "", RL(1, tmp), "d_finni_decorations_select", eNone, eNone, eNone, 10000, True, "vo_trex"
        Case 5:DMDFlush:DMD "", RL(1, tmp), "d_finni_baking_select", eNone, eNone, eNone, 10000, True, "vo_megalodon"
        Case 6:DMDFlush:DMD "", RL(1, tmp), "d_finni_pinata_select", eNone, eNone, eNone, 10000, True, "vo_sauron"
        Case 7:DMDFlush:DMD "", RL(1, tmp), "d_finni_party_select", eNone, eNone, eNone, 10000, True, "vo_mrsinister"
    End Select
End Sub`;
