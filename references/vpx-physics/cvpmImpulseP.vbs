Class cvpmImpulseP
	Private mEnabled, mBalls, mTrigger, mEntrySnd, mExitSnd, MExitSndBall
	Public X, Y, Strength, Res, Size, Solenoid, IMPowerOut, Time, mCount, Pull, IMPowerTrans, cFactor, Auto, RandomOut, SwitchNum, SwitchOn, BallOn

	Private Sub Class_Initialize
		Size = 1 : Strength = 0 : Solenoid = 0 : Res = 1 : IMPowerOut = 0 : Time = 0 : mCount = 0 : mEnabled = False
		Pull = 0 : IMPowerTrans = 0 : Auto = False : RandomOut = 0 : SwitchOn = 0 : SwitchNum = 0 : BallOn = 0
		Set mBalls = New cvpmDictionary
	End Sub

	Private Property Let NeedUpdate(aEnabled) : vpmTimer.EnableUpdate Me, True, aEnabled : End Property

	Public Sub InitImpulseP(aTrigger, aStrength, aTime)
		Dim tmp
		If vpmIsArray(aTrigger) Then Set tmp = aTrigger(0) Else Set tmp = aTrigger
		X = tmp.X : Y = tmp.Y : Size = tmp.Radius : vpmTimer.InitTimer tmp, True
		If IsArray(aTrigger) Then mTrigger = aTrigger Else Set mTrigger = aTrigger
		Strength = aStrength
		Res = 500
		Time = aTime
		If aTime = 0 Then
			Auto = True
		Else
			cFactor = (Res / Time) / 100
			Auto = False
		End If
	End Sub

	Public Sub CreateEvents(aName)
		If vpmCheckEvent(aName, Me) Then
			vpmBuildEvent mTrigger, "Hit", aName & ".AddBall ActiveBall"
			vpmBuildEvent mTrigger, "UnHit", aName & ".RemoveBall ActiveBall"
		End If
	End Sub


	Public Property Let PlungeOn(aEnabled) : mEnabled = aEnabled : End Property
	Public Property Get PlungeOn
		If Solenoid > 0 Then PlungeOn = Controller.Solenoid(Solenoid) Else PlungeOn = mEnabled
	End Property

	Public Sub AddBall(aBall)
		Dim mSwcopy
		With mBalls
			If .Exists(aBall) Then .Item(aBall) = .Item(aBall) + 1 Else .Add aBall, 1 : NeedUpdate = True
		End With
		If SwitchOn = True Then
			mSwcopy = SwitchNum
			Controller.Switch(mSwcopy) = 1
		End If
		BallOn = 1
	End Sub

	Public Sub RemoveBall(aBall)
		Dim mSwcopy
		With mBalls
			If .Exists(aBall) Then .Item(aBall) = .Item(aBall) - 1 : If .Item(aBall) <= 0 Then .Remove aBall
			NeedUpdate = (.Count > 0)
		End With
		If SwitchOn = True Then
			mSwcopy = SwitchNum
			Controller.Switch(mSwcopy) = 0
		End If
		BallOn = 0
	End Sub

	Public Property Get Balls : Balls = mBalls.Keys : End Property

	Public Sub Update
		Dim obj
		If pull = 1 and mCount < Res Then
			mCount = mCount + cFactor
			IMPowerTrans = mCount
			NeedUpdate = True
		Else
			IMPowerTrans = mCount
			NeedUpdate = False
		End If
		If PlungeOn Then
			On Error Resume Next
			For Each obj In mBalls.Keys
				If obj.X < 0 Or Err Then : mBalls.Remove obj : Else : PlungeBall obj : End If
			Next
			On Error Goto 0
		End If
	End Sub

	Public Sub PlungeBall(aBall)
		aBall.VelY = IMPowerOut
	End Sub

	Public Sub Random(aInput) ' Random Output Varience
		RandomOut = aInput
	End Sub

	Public Sub Fire	' Resets System and Transfer Power Value
		If Auto = True Then
		IMPowerOut = -Strength + ((Rnd) * RandomOut)
		Else
		IMPowerOut = -Strength * (IMPowerTrans + ((Rnd-0.5) * cFactor * RandomOut)) / Res
		End If
		PlungeOn = True
		Update
		PlungeOn = False
		Pull = 0 : IMPowerOut = 0 : IMPowerTrans = 0 : mCount = 0
		If BallOn = 1 Then : PlaySound mExitSndBall : Else : PlaySound mExitSnd : End If
	End Sub

	Public Sub AutoFire	' Auto-Fire Specific Call (so you don't have to change timing)
		IMPowerOut = -Strength + ((Rnd) * RandomOut)
		PlungeOn = True
		Update
		PlungeOn = False
		Pull = 0 : IMPowerOut = 0 : IMPowerTrans = 0 : mCount = 0
		If BallOn = 1 Then : PlaySound mExitSndBall : Else : PlaySound mExitSnd : End If
	End Sub

	Public Sub Pullback ' Pull Plunger
		Pull = 0 : IMPowerOut = 0 : IMPowerTrans = 0 : mCount = 0 ' reinitialize to be sure
		Pull = 1 : NeedUpdate = True
		PlaySound mEntrySnd
	End Sub

	Public Sub PullbackandRetract ' Pull Plunger and retract
		Pull = 0 : IMPowerOut = 0 : IMPowerTrans = 0 : mCount = 0 ' reinitialize to be sure
		Pull = 1 : NeedUpdate = True
		PlaySound mEntrySnd
	End Sub

	Public Sub Switch(aSw)
		SwitchOn = True
		SwitchNum = aSw
	End Sub

	Public Sub InitEntrySnd(aNoBall) : mEntrySnd = aNoBall : End Sub
	Public Sub InitExitSnd(aBall, aNoBall) : mExitSndBall = aBall : mExitSnd = aNoBall : End Sub
End Class
