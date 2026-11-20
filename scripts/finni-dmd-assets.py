"""All Finni display artwork. Legacy IDs are compatibility slots, never source pixels."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image, ImageDraw
ART = ROOT/'assets/finni/dmd'
BG = '#10051d'
CREAM = '#fff0c8'
PURPLE = '#8272f5'
ORANGE = '#ed762f'
GREEN = '#4db237'


def illustrations():
    sheet = Image.open(ART/'main-scenes-reference.png').convert('RGB')
    w,h = sheet.size
    result = {}
    for i,name in enumerate(['invitations','balloons','decorations','baking','pinata','party']):
        x,y = i%3,i//3
        # The atlas has generous margins; trim those while keeping every prop.
        result[name] = sheet.crop((round(w*x/3+w*.018), round(h*y/2+h*.045),
                                   round(w*(x+1)/3-w*.018), round(h*(y+1)/2-h*.045)))
    result['cookies'] = Image.open(ART/'cookies-reference.png').convert('RGB')
    approved = Image.open(ART/'approved-concepts.png').convert('RGB')
    w,h = approved.size
    for i,name in enumerate(['finni','presents','cake','disco']):
        result[name] = approved.crop((round(w*.10),round(h*i/4+7),
                                     round(w*(.30 if i in (0,3) else .40)),round(h*(i+1)/4-7)))
    return result


def icon(kind):
    im = Image.new('RGBA',(12,22),(0,0,0,0)); d = ImageDraw.Draw(im)
    if kind == 'timer':
        d.rectangle((4,2,7,3),fill=CREAM);d.ellipse((1,5,10,16),fill=PURPLE,outline=CREAM)
        d.line((6,7,6,11,8,13),fill=CREAM,width=1)
    elif kind == 'lights':
        d.line((0,5,11,5),fill=CREAM)
        for x,color in [(2,ORANGE),(6,PURPLE),(10,GREEN)]:
            d.line((x,5,x,9),fill=CREAM);d.rectangle((x-1,9,x+1,13),fill=color)
    elif kind == 'checklist':
        d.rectangle((1,3,10,18),fill=CREAM)
        for y in [6,11,16]:
            d.line((2,y,3,y+1,5,y-1),fill=GREEN);d.line((7,y,9,y),fill=PURPLE)
    elif kind in ('favors','supplies'):
        d.rectangle((1,8,10,18),fill=ORANGE if kind=='favors' else PURPLE)
        d.rectangle((0,6,11,9),fill=PURPLE if kind=='favors' else ORANGE)
        d.line((6,6,6,18),fill=CREAM,width=2)
        d.line((6,6,2,4,3,2,6,6,9,2,10,4,6,6),fill=CREAM)
    elif kind == 'confetti':
        for box,color in [((1,4,3,6),ORANGE),((8,3,10,5),PURPLE),((4,9,6,12),CREAM),((1,15,3,17),GREEN),((8,15,10,18),ORANGE)]:
            d.rectangle(box,fill=color)
    elif kind == 'snacks':
        d.polygon([(2,12),(9,12),(8,18),(3,18)],fill=PURPLE)
        d.ellipse((1,7,10,14),fill=CREAM);d.rectangle((5,5,6,7),fill=ORANGE)
    elif kind == 'ribbon':
        d.line((2,3,8,3,8,7,3,7,3,12,9,12,9,17,4,17),fill=PURPLE,width=3)
        d.rectangle((1,2,4,4),fill=CREAM)
    else:
        raise ValueError(kind)
    return im


def build(label, font):
    illustrations_by_name = illustrations()
    theme = json.loads((ROOT/'design/finni-dmd-theme.json').read_text())
    sprites = {}; layout = {}; motion = {}

    def scene(name, art, lines=(), header=False, overlay=False, side=False):
        im = Image.new('RGB',(256,64),BG)
        if overlay:
            # Both native rows stay entirely readable. Only a small corner
            # decoration sits outside the 240x50 text area.
            d=ImageDraw.Draw(im)
            for x,y,c in [(2,2,ORANGE),(250,2,PURPLE),(2,59,GREEN),(250,59,ORANGE)]:
                d.rectangle((x,y,x+3,y+2),fill=c)
        else:
            pic = illustrations_by_name[art].copy()
            pic.thumbnail((64,28) if header else (104,58),Image.Resampling.NEAREST)
            im.paste(pic,((68-pic.width)//2 if header else (110-pic.width)//2,
                          (30-pic.height)//2 if header else (64-pic.height)//2))
            x=72 if header else 114
            for i,line in enumerate(lines):
                scale = min(2,(256-x)//(len(line)*6-1))
                if len(lines)==1:y=8 if header else 25
                else:y=(1+i*15) if (header or side) else (12+i*24)
                label(im,line,x,y,scale)
            if header:ImageDraw.Draw(im).line((8,31,247,31),fill=PURPLE)
        sprites[name]=im;layout[name]='overlay' if overlay else 'header' if header else 'side' if side else 'full'
        if not overlay:
            motion[name] = {'art':art, 'bounds':[0,0,68,30] if header else [0,0,110,64]}

    scene('d_title','finni',["FINNI'S",'BIG DAY'])
    scene('d_gameover','finni',['GAME','OVER'])
    scene('d_jppresents','finni',['TABLE BY','JP SALAS'])
    for task in theme['tasks']:
        scene(task['sprite'],task['art'],task['title'],True)
        scene(task['sprite']+'_select',task['art'],task['title'],side=True)
        scene('d_'+task['key'],task['art'],task['title'],True)
        scene(task['sprite']+'_done',task['art'],['TASK','COMPLETE'],True)
    for name,art,title in [
        ('cake','cake','CAKE TIME'),('toppings','cake','CAKE TOPPINGS'),
        ('flourish','cake','FINAL FLOURISH'),('frosting','cake','MORE FROSTING'),
        ('friendship','party','FRIENDSHIP'),('supplyrun','presents','SUPPLY RUN'),
        ('streamers','decorations','STREAMER RUSH'),('spinner','disco','SPINNER RUSH'),
        ('confetti','party','CONFETTI BURST'),('snack','cake','SNACKS'),
        ('choose','presents','CHOOSE A TASK'),('mystery','presents','MYSTERY AWARD')]:
        scene('d_finni_'+name,art,[title],True)
    scene('d_finni_disco','disco',['DISCO','LOOPS'])
    scene('d_finni_discomb','disco',['DISCO','MULTIBALL'])
    for key,title,kind in [('timer','KITCHEN TIMER','timer'),('lights','PARTY LIGHTS','lights'),
                            ('checklist','CHECKLIST','checklist'),('favors','PARTY FAVORS','favors')]:
        name='d_finni_'+key
        scene(name,'finni',[title],True)
        im=sprites[name];ImageDraw.Draw(im).rectangle((0,0,68,29),fill=BG)
        prop=icon(kind);prop.thumbnail((24,28),Image.Resampling.NEAREST)
        im.paste(prop,(27,3),prop)
    # Every original fullscreen asset is explicitly assigned, including unused
    # ones. Unknown future source slots fail instead of leaking old artwork.
    full = {
        'd_ballsaved':('finni',['BALL','SAVED']), 'd_bam':('party',['NICE','SHOT']),
        'd_boom':('presents',['SURPRISE','BONUS']), 'd_colossus':('finni',['PARTY','LIGHTS']),
        'd_dazzler':('finni',['KITCHEN','TIMER']), 'd_domino':('presents',['PARTY','FAVORS']),
        'd_extraball':('finni',['EXTRA','BALL']), 'd_jackpot':('party',['JACKPOT']),
        'd_lildpmb':('cake',['CAKE TIME','MULTIBALL']),
        'd_lock1':('party',['ONE FRIEND','READY']), 'd_lock2':('party',['TWO FRIENDS','READY']),
        'd_lock3':('party',['THREE FRIENDS','READY']), 'd_lockislit':('party',['GATHER','FRIENDS']),
        'd_loopjackpot':('disco',['LOOP','JACKPOT']), 'd_mechsuit':('presents',['SUPPLY RUN','MULTIBALL']),
        'd_multiball':('party',['MULTIBALL']), 'd_mystery':('presents',['MYSTERY','AWARD']),
        'd_skillshot':('finni',['SKILLSHOT']), 'd_superjackpot':('party',['SUPER','JACKPOT']),
        'd_superskillshot':('finni',['SUPER','SKILLSHOT']), 'd_tilt':('finni',['TILT']),
        'd_wolverine':('presents',['THE','CHECKLIST'])
    }
    for name,(art,lines) in full.items():scene(name,art,lines)
    # Dedicated art for each actual lock announcement and the multiball start.
    import runpy
    friendship_art=runpy.run_path(str(ROOT/'scripts/finni-dmd-motion.py'))['friendship_art']
    for count in (1,2,3):
        name='d_finni_friend'+str(count)
        scene(name,'party',['FRIENDSHIP'],True)
        sprites[name].paste(friendship_art(sprites['d_multiball'],count,68,30),(0,0))
    scene('d_finni_friendship_start','party',['FRIENDSHIP','MULTIBALL'])
    sprites['d_finni_friendship_start'].paste(friendship_art(sprites['d_multiball'],3,110,64,cheer=True),(0,0))
    for i in range(1,5):scene('d_player'+str(i),'finni',['PLAYER',str(i)])
    for i in range(1,6):scene('d_combo'+(str(i) if i>1 else ''),'disco',(['COMBO'] if i==1 else [str(i)+'X','COMBO']))
    scene('d_chimi2','cake',['SNACKS'],True)
    scene('d_star2','party',['CONFETTI'],True)
    scene('d_ninjamb','party',['CONFETTI BURST'],True)
    for i in range(1,7):scene('d_diamond'+str(i),'decorations',['COLLECT RIBBONS'],True)
    # Two live text rows remain intact on scoring and qualification messages.
    for key in ('award','bonus','ready','combo'):
        name='d_finni_'+key
        scene(name,'party',overlay=True)
        motion[name]={'art':'party','bounds':[0,0,256,64],'effect':'edge_'+key}
    for name in ('bkempty','bkborder','d_grid'):
        im=Image.new('RGB',(256,64),BG)
        if name!='bkempty':ImageDraw.Draw(im).rectangle((0,0,255,63),outline=PURPLE)
        sprites[name]=im;layout[name]='overlay'

    # Native glyphs use the SAME bitmap typography as the illustrations.
    chars={**{f'd_{c.lower()}':c for c in font if c.isalnum()},
           'd_empty':' ','d_dot':'.','d_comma':',','d_plus':'+','d_minus':'-',
            'd_under':'_','d_less':'<','d_more':'>','d_equal':'=','d_up':'^'}
    font['=']='00000/00000/11111/00000/11111/00000/00000'
    font['^']='00100/01010/10001/00000/00000/00000/00000'
    for name,c in chars.items():
        im=Image.new('RGBA',(12,22),(0,0,0,0));label(im,c,1,4)
        sprites[name]=im;layout[name]='glyph'
    for i in range(10):
        # Source lowercase a..i encode digit+separator, not plain digits.
        im=Image.new('RGBA',(12,22),(0,0,0,0));label(im,str(i),0,4)
        ImageDraw.Draw(im).rectangle((10,18,11,19),fill=CREAM)
        sprites[f'd_{i}a']=im;layout[f'd_{i}a']='glyph'
    for name,kind in [('d_daz','timer'),('d_col','lights'),('d_wol','checklist'),
                       ('d_dom','favors'),('d_star','confetti'),('d_chimi','snacks'),('d_gun','supplies')]:
        sprites[name]=icon(kind);layout[name]='glyph'
    for i in range(5):
        im=Image.new('RGBA',(12,22),(0,0,0,0));d=ImageDraw.Draw(im)
        for j in range(4):d.rectangle((2,16-j*4,9,18-j*4),fill=GREEN if j<i else '#45384f')
        sprites[f'd_power{i}']=im;layout[f'd_power{i}']='glyph'
    for part in ('l','m','r'):
        for state in ('on','off'):
            name='d_life'+part+state
            im=Image.new('RGBA',(12,22),(0,0,0,0));d=ImageDraw.Draw(im)
            d.rectangle((0,7,11,15),fill=GREEN if state=='on' else '#45384f')
            d.line((0,6,11,6),fill=PURPLE);d.line((0,16,11,16),fill=PURPLE)
            sprites[name]=im;layout[name]='glyph'

    # Author at native pixel resolution. Text and the live instruction/meter
    # regions are never transformed; only the illustration gets movement.
    import runpy
    # Compatibility-only aliases remain static and never enter runtime routing.
    for unused in ['d_lildpmb']+['d_'+task['key'] for task in theme['tasks']]:
        motion.pop(unused,None)
    animations = runpy.run_path(str(ROOT/'scripts/finni-dmd-motion.py'))['build_frames'](sprites, layout, motion)
    (ART/'animations.json').write_text(json.dumps(animations,indent=2)+'\n')
    source=json.loads((ROOT/'.work/deadpool-extracted/images.json').read_text())
    source_names={e['name'].lower() for e in source if e['name'].lower().startswith(('d_','bk'))}
    assert source_names <= sprites.keys(), 'Unmapped DMD assets: '+str(source_names-sprites.keys())
    out=ART/'sprites';out.mkdir(exist_ok=True)
    manifest={}
    for name,im in sprites.items():
        im.save(out/(name+'.png'))
        manifest[name]={'file':'sprites/'+name+'.png','layout':layout[name],'size':list(im.size)}
    (ART/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return sprites


def install(table,label,font):
    sprites=build(label,font)
    metadata=json.loads((table/'images.json').read_text())
    metadata=[e for e in metadata if not e['name'].lower().startswith(('d_','bk'))]
    for name in sprites:
        output=table/'images'/(name+'.png')
        output.write_bytes((ART/'sprites'/(name+'.png')).read_bytes())
        metadata.append(dict(name=name,path=output.name,alpha_test_value=1.0,is_signed=False))
    (table/'images.json').write_text(json.dumps(metadata,indent=2))
    items=json.loads((table/'gameitems.json').read_text())
    timer='Timer.FinniDmdAnimationTimer.json'
    if not any(e['file_name']==timer for e in items):
        items.append(dict(file_name=timer,is_locked=True,editor_layer=0,
                          editor_layer_name='Finni display',editor_layer_visibility=True))
    (table/'gameitems.json').write_text(json.dumps(items,indent=2))
    (table/'gameitems'/timer).write_text(json.dumps({'Timer':dict(
        center=dict(x=-300,y=100),is_timer_enabled=True,timer_interval=160,
        name='FinniDmdAnimationTimer',backglass=False)},indent=2))
    return {'all_dmd_slots_replaced':len(sprites),'legacy_dmd_pixels_retained':False}
