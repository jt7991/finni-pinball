"""Complete Finni display presentation. Rules, expressions and event tails survive."""
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]


def first_pass_script(source):
    replacements = [
        (b'DMD CL(0, "WRAP THE PRESENTS"), tmp, "bkborder"',
         b'DMD "", tmp, "d_finni_presents"', 1),
        (b'DMD CL(0, "WRAP THE PRESENTS"), CL(1, "TARGETS / LIT SHOTS"), "bkborder"',
         b'DMD "", CL(1, "TARGETS + LIT SHOTS"), "d_finni_presents"', 1),
        (b'DMD CL(0, "CAKE TIME"), CL(1, "MULTIBALL"), "bkborder"',
         b'DMD "", CL(1, "MULTIBALL"), "d_finni_cake"', 1),
        (b'DMD CL(0, "CAKE TOPPINGS"), CL(1, "SHOOT LIT SHOTS"), "bkborder"',
         b'DMD "", CL(1, "SHOOT LIT SHOTS"), "d_finni_toppings"', 1),
        (b'DMD CL(0, "FINAL FLOURISH"), CL(1, "SHOOT SPINNERS"), "bkborder"',
         b'DMD "", CL(1, "SHOOT SPINNERS"), "d_finni_flourish"', 1),
        (b'DMD CL(0, "MORE FROSTING"), CL(1, "SHOOT FINNI"), "bkborder"',
         b'DMD "", CL(1, "SHOOT FINNI"), "d_finni_frosting"', 1),
        (b'DMD "_", CL(1, "DISCO LOOPS"), ""',
         b'DMD "", "", "d_finni_disco"', 1),
    ]
    for old, new, count in replacements:
        if source.count(old) != count:
            raise ValueError(f'Expected {count} DMD event(s): {old!r}')
        source = source.replace(old,new)
    return source


def dmd_script(source):
    source=first_pass_script(source)
    theme=json.loads((ROOT/'design/finni-dmd-theme.json').read_text())
    modes=json.loads((ROOT/'design/party-tasks.json').read_text())['modes']
    for task,mode in zip(theme['tasks'],modes):
        sprite=task['sprite'].encode()
        if task['key']!='juggernaut':
            # Selection preserves the live flipper/start instruction in tmp.
            old=('DMD CL(0, "'+mode['dmd']+'"), tmp, "bkborder"').encode()
            assert source.count(old)==1,old
            source=source.replace(old,b'DMD "", tmp, "'+sprite+b'"')
            old=('DMD CL(0, "'+mode['instruction'][0]+'"), CL(1, "'+mode['instruction'][1]+'"), "bkborder"').encode()
            assert source.count(old)==1,old
            source=source.replace(old,b'DMD "", CL(1, "'+mode['instruction'][1].encode()+b'"), "'+sprite+b'"')
        old=('DMD CL(0, "'+mode['complete'][0]+'"), CL(1, "'+mode['complete'][1]+'"), "bkborder"').encode()
        assert source.count(old)==1,old
        source=source.replace(old,b'DMD "", CL(1, "'+mode['complete'][0].encode()+b' '+mode['complete'][1].encode()+b'"), "'+sprite+b'_done"')
        old=b'DMD "", tmp, "'+sprite+b'"'
        assert source.count(old)==1,old
        source=source.replace(old,b'DMD "", RL(1, tmp), "'+sprite+b'_select"')

    replacements=[
        (b'DMD " CHOOSE YOUR BATTLE", "", ""',b'DMD "", CL(1, "FLIPPERS TO CHOOSE"), "d_finni_choose"'),
        (b'DMD "   BATTLE IS READY  ", "  AT THE HELLHOUSE  ", ""',b'DMD "", CL(1, "SHOOT THE SCOOP"), "d_finni_choose"'),
        (b'DMD CL(0, "NINJA"), CL(1, "APOCAYPSE"), "d_ninjamb"',b'DMD "", CL(1, "BONUS"), "d_finni_confetti"'),
        (b'DMD CL(0, "MECH SUIT"), CL(1, "MULTIBALL"), ""',b'DMD "", CL(1, "MULTIBALL"), "d_finni_supplyrun"'),
        (b'DMD CL(0, "FRIENDSHIP"), CL(1, "MULTIBALL"), ""',b'DMD "", CL(1, "MULTIBALL"), "d_finni_friendship"'),
        (b'DMD "_", CL(1, "DISCO MULTIBALL"), ""',b'DMD "", "", "d_finni_discomb"'),
        (b'DMD CL(0, "COLLECTED ONE"), CL(1, "CHIMICHANGA"), "d_chimi2"',b'DMD "", CL(1, "ONE COLLECTED"), "d_finni_snack"'),
        (b'DMD "", CL(1, FormatScore(ChimichangaValue(CurrentPlayer) ) ), "d_chimi2"',b'DMD "", CL(1, FormatScore(ChimichangaValue(CurrentPlayer) ) ), "d_finni_snack"'),
    ]
    for old,new in replacements:
        assert source.count(old)==1,old
        source=source.replace(old,new)
    for name,title in [('timer','KITCHEN TIMER'),('lights','PARTY LIGHTS'),('checklist','CHECKLIST'),('favors','PARTY FAVORS')]:
        pattern=rb'DMD CL\(0, "'+title.encode()+rb'"\), (CL\(1, "[^"\r\n]*"\)), "bkborder"'
        source,count=re.subn(pattern,lambda m:b'DMD "", '+m[1]+b', "d_finni_'+name.encode()+b'"',source)
        assert count==1,(title,count)
    for count in range(1,7):
        old=f'DMD "{count} DIAMOND{ "S" if count>1 else ""} COLLECTED", "", "d_diamond{count}"'.encode()
        assert source.count(old)==1,old
        source=source.replace(old,f'DMD "", CL(1, "{count} OF 6 COLLECTED"), "d_diamond{count}"'.encode())

    # Replace quoted DISPLAY strings only. In particular Weapons(), Battle(),
    # timer names, music/voice IDs and every numerical expression stay intact.
    words=[('MEGALODON SUPJACKPOT','COOKIE SUPER JACKPOT'),('MEGALODON JACKPOT','COOKIE JACKPOT'),
           ('MECHSUIT MB JACKPOT','SUPPLY RUN JACKPOT'),('TO MECHSUIT MB','TO SUPPLY RUN MB'),
           ('LIL DP JACKPOT','CAKE JACKPOT'),('KATANARAMA JACKPOT','STREAMER JACKPOT'),
           ('KATANARAMA TIME','STREAMER RUSH'),('BERSERKER RAGE','SPINNER RUSH'),
           ('NINJA STARS','CONFETTI'),('STARS','CONFETTI'),('CHIMICHANGAS','SNACKS'),('CHIMICHANGA','SNACK'),
           ('CHIMICHA','SNACKS'),('WEAPONS','SUPPLIES'),('DIAMONDS','RIBBONS'),('DIAMOND','RIBBON'),
           ('DEADPOOL WUZ HERE','FINNI WAS HERE'),('DEFEAT EVERYONE','FINISH THE TASKS'),
           ('REGENERATE IS LIT','EXTRA BALL IS LIT'),('REGENERATE','EXTRA BALL'),
           ('10 PESETAS','A PAPER NAPKIN'),('TO LIT EXTRA BALL','TO LIGHT EXTRA BALL'),
           ('ROM VERSION','TABLE VERSION')]
    lines=[]
    for line in source.splitlines(keepends=True):
        if re.search(rb'\bDMD ',line) and not line.lstrip().startswith(b"'"):
            def quoted(match):
                text=match[1].decode('ascii')
                if text.startswith(('vo_','d_','bk','fx_')):return match[0]
                for old,new in words:text=text.replace(old,new)
                return b'"'+text.encode()+b'"'
            line=re.sub(rb'"([^"\r\n]*)"',quoted,line)
        lines.append(line)
    source=b''.join(lines)
    # Phase starts and instruction cards retain their own live instruction rows.
    for title,sprite in [('SPINNER RUSH','spinner'),('STREAMER RUSH','streamers')]:
        source=source.replace(f'DMD CL(0, "STARTING"), CL(1, "{title}"), ""'.encode(),
                              f'DMD "", CL(1, "STARTING"), "d_finni_{sprite}"'.encode())
        pattern=rb'DMD CL\(0, "'+title.encode()+rb'"\), (CL\(1, "[^"\r\n]*"\)), ""'
        source,n=re.subn(pattern,lambda m:b'DMD "", '+m[1]+b', "d_finni_'+sprite.encode()+b'"',source)
        assert n==1,(title,n)
    source,n=re.subn(rb'DMD "   MYSTERY AWARD    ", ([^\r\n]*?), "", (eNone,)',
                     lambda m:b'DMD "", '+m[1]+b', "d_finni_mystery", '+m[2],source)
    assert n==27,('mystery events',n)
    for word in ('ONE','TWO','THREE'):
        old=f'DMD CL(0, "{word} FRIEND'+('S' if word!='ONE' else '')+'"), CL(1, "READY"), "bkborder"'
        new=f'DMD "", CL(1, "{word} FRIEND'+('S' if word!='ONE' else '')+' READY"), "d_finni_friendship"'
        assert source.count(old.encode())==1,old
        source=source.replace(old.encode(),new.encode())
    return source
