"""Small, deterministic pixel-art loops shared by native VPX and the web atlas."""
import math
import json
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw

BG='#10051d'
COLORS=['#ed762f','#8272f5','#fff0c8','#4db237']
FRAME_COUNT=12


@lru_cache(maxsize=None)
def toss_poses():
    """Use the original upright Finni art, including his feet."""
    poses = []
    for pose in pose_art('poses_wave', 110, 64):
        character = pose.crop((22, 0, 91, 64)).convert('RGBA')
        pixels = character.load()
        for y in range(character.height):
            for x in range(character.width):
                r, g, b, _ = pixels[x, y]
                if (r, g, b) == (16, 5, 29) or g > r + 14 and g > b + 14:
                    pixels[x, y] = (0, 0, 0, 0)
        poses.append(character.resize((48,45),Image.Resampling.NEAREST))
    return poses


def ball_toss(w, h, frame):
    """A quick toss and catch fits the original Ball Saved cue."""
    layer = Image.new('RGB', (w, h), BG)
    step = min(frame, 6)
    character = toss_poses()[(1, 2, 3, 3, 3, 2, 1)[step]]
    layer.paste(character,(23,14),character)

    draw = ImageDraw.Draw(layer)
    x, y = [(57,42),(62,31),(68,18),(73,10),(76,16),(73,28),(57,42)][step]
    if 1 <= step <= 5:
        direction = 1 if step <= 3 else -1
        draw.line((x-2,y+direction*6,x-4,y+direction*10),fill='#8272f5')
    draw.ellipse((x-4,y-4,x+4,y+4),fill='#b5becd')
    draw.ellipse((x-2,y-3,x,y-1),fill=COLORS[2])
    return layer


def friendship_art(source, count, w, h, frame=None, cheer=False):
    """Animate the approved fox, rabbit and bear, preserving the real lock count."""
    from collections import deque
    layer=Image.new('RGB',(w,h),BG)
    if cheer:
        layer.paste(source.crop((0,0,110,19)),(0,0))
    for index,box in enumerate(((22,20,49,55),(49,26,67,55),(67,27,86,55))):
        if index>=count:break
        friend=source.crop(box).convert('RGBA')
        # Remove connected dark background only; enclosed eyes/linework survive.
        pixels=friend.load();seen=set();todo=deque()
        for x in range(friend.width):todo.extend(((x,0),(x,friend.height-1)))
        for y in range(friend.height):todo.extend(((0,y),(friend.width-1,y)))
        while todo:
            x,y=todo.popleft()
            if (x,y) in seen or not (0<=x<friend.width and 0<=y<friend.height):continue
            seen.add((x,y));r,g,b,a=pixels[x,y]
            if max(r,g,b)>55 or r+g+b>85:continue
            pixels[x,y]=(r,g,b,0)
            todo.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
        height=40 if cheer else 20
        friend=friend.resize((round(friend.width*height/friend.height),height),Image.Resampling.NEAREST)
        x=(7+index*34) if cheer else (6+index*21)
        y=h-height-2
        if frame is not None:
            if cheer:
                y-=max(0,round(4*math.sin((frame-index*2)*math.pi/6)))
            elif index==count-1:
                # Settle well before the original 1500ms announcement ends.
                remaining=max(0,1-frame/5)
                x+=round((w+friend.width)*remaining*remaining)
                y-=round(2*math.sin(min(frame,5)*math.pi/5))
        layer.paste(friend,(x,y),friend)
    if cheer and frame is not None:
        d=ImageDraw.Draw(layer)
        for i in range(12):
            x=(i*23+frame*2)%(w-2);y=(i*11+frame*3)%(h+6)-4
            d.rectangle((x,y,x+1,y+1),fill=COLORS[i%4])
    return layer


def effect_for(name, art):
    if name.startswith('d_finni_friend') and name[-1:] in ('1','2','3'):return 'friend_arrival_'+name[-1]
    if name=='d_finni_friendship_start':return 'friendship_start'
    # Replace the illustration with authored character poses. These are not
    # decorations composited over the original still.
    if name in ('d_title','d_gameover'):return 'poses_wave'
    if name.startswith('d_finni_presents') or name in ('d_finni_mystery','d_mystery','d_boom','d_finni_favors','d_domino'):
        return 'poses_wrap'
    if name.startswith('d_finni_baking'):return 'poses_cookies'
    if name in ('d_finni_cake','d_finni_frosting','d_finni_toppings','d_finni_flourish'):
        return 'poses_frosting'
    if name in ('d_finni_disco','d_finni_discomb'):return 'poses_disco'
    if name.startswith('d_finni_decorations'):return 'poses_bunting'
    if name.startswith('d_finni_balloons'):return 'poses_pump'
    if name.startswith('d_finni_pinata'):return 'poses_pinata'
    if name.endswith('_done'):return 'confetti'
    if name.endswith('_select') or name=='d_finni_choose':return 'selection'
    if 'mystery' in name or name=='d_boom':return 'mystery'
    if name=='d_ballsaved':return 'ball_toss'
    if name=='d_extraball':return 'ball_return'
    if name=='d_finni_timer' or name=='d_dazzler':return 'timer'
    if name=='d_finni_checklist' or name=='d_wolverine':return 'page_turn'
    if 'supplyrun' in name or name=='d_mechsuit':return 'parcels'
    if 'streamers' in name or 'diamond' in name:return 'ribbons'
    if name=='d_finni_spinner' or 'combo' in name:return 'record'
    if 'snack' in name or name=='d_chimi2':return 'steam'
    if 'friendship' in name or name.startswith('d_lock'):return 'friendship'
    if any(s in name for s in ('jackpot','multiball','discomb','skillshot','confetti','bam')):return 'confetti'
    return {'balloons':'balloons','cake':'candles','baking':'candles','cookies':'steam',
            'disco':'lights','decorations':'lights','party':'lights',
            'presents':'ribbons','invitations':'envelopes','pinata':'pinata'}.get(art,'sparkles')


def details(d, effect, frame, w, h):
    """All props live within the illustration crop, away from live typography."""
    phase=frame*math.pi/6
    if effect=='selection':
        x=3+(1 if frame in (3,4,5) else 0);y=h//2
        d.line((x,y-3,x+3,y,x,y+3),fill=COLORS[2],width=1)
        d.line((w-6,y-3,w-3,y,w-6,y+3),fill=COLORS[1],width=1)
    elif effect=='envelopes':
        x=round((frame/12)*(w+14))-14;y=3+round(2*math.sin(phase))
        d.rectangle((x,y,x+10,y+7),fill=COLORS[2])
        d.line((x,y,x+5,y+4,x+10,y),fill=COLORS[1])
    elif effect in ('ribbons','parcels'):
        if effect=='parcels':
            x=(frame*3)%(w+12)-12;y=h-11
            d.rectangle((x,y,x+9,y+8),fill=COLORS[1])
            d.rectangle((x-1,y,x+10,y+2),fill=COLORS[0])
            d.line((x+5,y-1,x+5,y+8),fill=COLORS[2])
        else:
            x=w-10;y=5
            for i in range(min(17,h-9)):
                dx=round(2*math.sin(phase+i*.45))
                d.rectangle((x+dx,y+i,x+dx+1,y+i),fill=COLORS[1 if i%5 else 2])
    elif effect=='mystery':
        # A quiet, rotating reveal around the present, never a display flash.
        for i in range(5):
            a=phase+i*math.tau/5
            x=w//2+round((w//2-5)*math.cos(a));y=h//2+round((h//2-4)*math.sin(a))
            d.line((x,y,x+round(2*math.cos(a)),y+round(2*math.sin(a))),fill=COLORS[(i+frame//3)%4])
    elif effect=='ball_return':
        x=5+round((w-14)*frame/11);y=h-7-round(10*math.sin(frame*math.pi/11))
        d.line((x-5,y+1,x-2,y+1),fill=COLORS[1])
        d.ellipse((x,y,x+5,y+5),fill='#b5becd')
        d.point((x+1,y+1),fill=COLORS[2])
    elif effect=='timer':
        # The actual timer icon is centered at (33,14); just its hand moves.
        x,y=(33,14) if w==68 else (w-12,11)
        d.ellipse((x-4,y-4,x+4,y+4),fill=COLORS[1],outline=COLORS[2])
        d.line((x,y,x+round(3*math.sin(phase)),y-round(3*math.cos(phase))),fill=COLORS[2])
    elif effect=='page_turn':
        x=36 if w==68 else w-9;y=4
        fold=1+min(frame,11-frame)//2
        d.polygon([(x-fold,y),(x,y),(x,y+fold)],fill=COLORS[1])
    elif effect=='record':
        x=w-12;y=h-10
        d.ellipse((x-7,y-7,x+7,y+7),fill='#24122f',outline=COLORS[1])
        d.line((x,y,x+round(5*math.cos(phase)),y+round(5*math.sin(phase))),fill=COLORS[2])
        d.point((x,y),fill=COLORS[0])
    elif effect=='steam':
        for i in range(2):
            y=2+(11-(frame+i*5)%12);x=w-14+i*6+round(math.sin(phase+i))
            d.line((x,y+3,x-1,y+1,x,y),fill=COLORS[2])
    elif effect=='friendship':
        for i in range(3):
            x=5+i*8;y=3-round(math.sin(phase+i))
            c=COLORS[0] if (frame//3+i)%4!=0 else COLORS[1]
            d.line((x,y,x+1,y+1,x+2,y,x+3,y+1,x+1,y+3,x-1,y+1,x,y),fill=c)


POSE_ROWS = {'poses_wave':0, 'poses_wrap':1, 'poses_cookies':2,
             'poses_frosting':3, 'poses_disco':4, 'poses_bunting':5,
             'poses_pump':6, 'poses_pinata':7}


@lru_cache(maxsize=None)
def pose_art(effect, w, h):
    """One shared crop/scale per row keeps the animation's camera registered."""
    path=Path(__file__).resolve().parents[1]/'assets/finni/dmd/character-motion-reference.png'
    sheet=Image.open(path).convert('RGB')
    layout=json.loads(path.with_name('character-motion-layout.json').read_text())
    assert list(sheet.size)==layout['size'], 'Character sheet dimensions changed'
    row=POSE_ROWS[effect]
    top,bottom=layout['row_edges'][row:row+2]
    cells=[]
    for col in range(6):
        cell=sheet.crop((round(col*sheet.width/6),top,
                         round((col+1)*sheet.width/6),bottom))
        # Normalize the sheet's dark backdrop to the native display color.
        cell.putdata([tuple(bytes.fromhex(BG[1:])) if max(pixel)<50 else pixel
                      for pixel in cell.getdata()])
        cells.append(cell)
    from PIL import ImageChops
    boxes=[ImageChops.difference(cell,Image.new('RGB',cell.size,BG)).getbbox() for cell in cells]
    assert all(boxes),effect
    box=(min(b[0] for b in boxes),min(b[1] for b in boxes),
         max(b[2] for b in boxes),max(b[3] for b in boxes))
    scale=min((w-4)/(box[2]-box[0]),(h-2)/(box[3]-box[1]))
    size=(round((box[2]-box[0])*scale),round((box[3]-box[1])*scale))
    result=[]
    for cell in cells:
        layer=Image.new('RGB',(w,h),BG)
        pic=cell.crop(box).resize(size,Image.Resampling.NEAREST)
        layer.paste(pic,((w-size[0])//2,h-size[1]-1))
        result.append(layer)
    return result


def build_frames(sprites, layouts, scenes):
    animations={}
    for name, spec in scenes.items():
        if name in ('d_tilt','d_jppresents'):
            continue
        base=sprites[name]
        bounds=spec['bounds']; w,h=bounds[2:]
        art=spec['art']
        effect=spec.get('effect') or effect_for(name,art)
        if effect == 'ball_toss':
            base.paste(ball_toss(w,h,6),bounds[:2])
        celebration=effect=='confetti'
        frames=[]
        for frame in range(FRAME_COUNT):
            im=base.copy()
            layer=Image.new('RGB',(w,h),BG)
            # A one-pixel cheer on rewards; no repeated movement of the labels.
            hop=-1 if celebration and frame in (2,3,4) else 0
            layer.paste(base.crop(bounds),(0,hop))
            if effect.startswith('friend_arrival_') or effect=='friendship_start':
                count=int(effect[-1]) if effect.startswith('friend_arrival_') else 3
                layer=friendship_art(sprites['d_multiball'],count,w,h,frame,effect=='friendship_start')
            if effect=='pinata':
                # Pendulum motion is applied to the illustration only.
                shift=round(2*math.sin(frame*math.pi/6))
                layer=Image.new('RGB',(w,h),BG)
                layer.paste(base.crop(bounds),(shift,0))
            d=ImageDraw.Draw(layer)
            if effect == 'ball_toss':
                layer=ball_toss(w,h,frame)
            elif effect in POSE_ROWS:
                # Fully replace the old illustration, including its props.
                layer=pose_art(effect,w,h)[frame//2].copy()
            elif effect == 'score_lights':
                for i in range(8):
                    x = 10 + i*29
                    for y, offset in ((3, 0), (59, 4)):
                        phase = (frame-i+offset) % FRAME_COUNT
                        color = spec['color'] if phase < 4 else '#45384f'
                        d.rectangle((x,y,x+4,y+1),fill=color)
                        if phase == 0:
                            d.point((x+2,y-1),fill=COLORS[2])
            elif effect.startswith('edge_'):
                # Confine reward motion to the top/bottom margins and side
                # gutters. Both complete 240x22 native text rows stay clear.
                for i in range(9):
                    x=(i*29+frame*4)%252+1
                    y=1 if i%2 else 60
                    c=COLORS[(i+frame//3)%4]
                    d.rectangle((x,y,min(x+2,254),y+1),fill=c)
                if effect in ('edge_award','edge_combo'):
                    for i in range(4):
                        y=(i*17+frame*3)%60+1
                        d.rectangle((2,y,4,min(y+2,62)),fill=COLORS[i%4])
                        d.rectangle((251,y,253,min(y+2,62)),fill=COLORS[(i+1)%4])
            elif effect=='confetti':
                for i in range(9):
                    x=3+(i*29+int(2*math.sin((frame+i)*math.pi/6)))%(w-6)
                    y=(i*17+frame*3)%(h+8)-4
                    d.rectangle((x,y,x+(1 if (i+frame)%3 else 2),y+1),fill=COLORS[i%4])
            elif effect=='balloons':
                # Tiny balloons rise at the edge of the original illustration.
                for i in range(2):
                    x=w-9-i*9; y=h-((frame*2+i*13)%(h+12))
                    d.line((x,y+4,x-1,y+10),fill=COLORS[2])
                    d.ellipse((x-3,y-3,x+3,y+4),fill=COLORS[i])
            elif effect=='candles':
                # Candlelight glints stay beside the cake, outside live text.
                for i in range(3):
                    x=w-19+i*5; y=6+(i%2)*3
                    if (frame+i*3)%6<4:
                        d.line((x,y+2,x,y-1-(frame+i)%2),fill=COLORS[2])
                        d.point((x+1,y+1),fill=COLORS[0])
            elif effect=='lights':
                d.line((3,2,w-4,2),fill='#45384f')
                for i in range(7):
                    x=5+i*(w-10)//6
                    d.rectangle((x,3,x+1,4),fill=COLORS[(i+frame//3)%4] if (frame+i)%6<4 else '#45384f')
            elif effect=='sparkles':
                for i,(x,y) in enumerate([(w-8,8),(7,h-8),(w-17,h-7)]):
                    phase=(frame+i*4)%12
                    if phase in (1,2,3):
                        d.point((x,y),fill=COLORS[2])
                        if phase==2:
                            d.line((x-2,y,x+2,y),fill=COLORS[2])
                            d.line((x,y-2,x,y+2),fill=COLORS[2])
            else:
                details(d,effect,frame,w,h)
            im.paste(layer,bounds[:2])
            key=f'{name}_anim{frame:02}'
            sprites[key]=im;layouts[key]=layouts[name];frames.append(key)
        animations[name]={'frames':frames,'frame_ms':160,'effect':effect}
    return animations
