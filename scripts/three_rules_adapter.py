"""Preserve authored VPX rules while replacing their native host bootstrap."""
import re

def adapt_rules(script):
    script=script.replace('\r\n','\n')
    script=re.sub(r'Sub LoadCoreFiles\b.*?End Sub','Sub LoadCoreFiles\nEnd Sub',script,flags=re.S|re.I)
    script=script.replace('Set plungerIM = New cvpmImpulseP','Set plungerIM = HostPlunger')
    script=script.replace('ReDim rolling(tnob)','Dim rolling()\nReDim rolling(tnob)')
    script=script.replace('Len(TempStr)> Space(dCharsPerLine(id) )','Len(TempStr)> dCharsPerLine(id)')
    script=script.replace('Left(TempStr, Space(dCharsPerLine(id) ) )','Left(TempStr, dCharsPerLine(id) )')
    script=script.replace('set RainbowLights = n','RainbowLights = n')
    for timer in ('LilDPTimer','LilDPSpinner'):
        def bind(match):
            body,count=re.subn(r'\bMe\.Enabled\b',timer+'.Enabled',match[0],flags=re.I)
            if count!=1:raise ValueError('Unexpected native timer alias '+timer)
            return body
        script,count=re.subn(r'Sub '+timer+r'_Timer\b.*?End Sub',bind,script,count=1,flags=re.S|re.I)
        if count!=1:raise ValueError('Missing native timer '+timer)
    return re.sub(r'^Sub FlashForMs\(MyLight, TotalPeriod, BlinkPeriod, FinalState\).*?^End Sub','Sub FlashForMs(MyLight, TotalPeriod, BlinkPeriod, FinalState)\n HostFlash MyLight, TotalPeriod, BlinkPeriod, FinalState\nEnd Sub',script,flags=re.S|re.I|re.M)
