export function createViews(evaluate, ready, release=()=>{}){
  const select=document.getElementById('camera-view');
  const picker=select.closest('label');
  const desktopAnchor=document.createComment('camera picker');picker.before(desktopAnchor);
  const phone=matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)');
  function placePicker(){
    if(phone.matches){document.getElementById('camera-controls').append(picker);picker.classList.add('in-controls');}
    else{desktopAnchor.after(picker);picker.classList.remove('in-controls');}
  }
  phone.addEventListener('change',placePicker);placePicker();
  const presets={classic:[48,48,5,50,-350,1],balanced:[30,40,0,30,-350,1],topdown:[0,10,0,0,-350,1],playfield:[0,10,0,75,-350,1.08]};
  select.value='balanced';
  const portrait=document.getElementById('portrait');
  const screen=document.querySelector('.screen');
  const canvas=document.getElementById('canvas');
  function fitCanvas(){
    // Keep the native render's proportions while cropping only its side space.
    // A CSS rotation changes bounding boxes; stretching that image would distort
    // the ball and table when switching orientation during a running game.
    if(!ready())return;
    const aspect=canvas.width/canvas.height;
    const safeAspect={classic:.85,balanced:.70,topdown:.50,playfield:.54}[select.value]||.85;
    // The engine can switch from its initial wide buffer to a portrait buffer.
    // Never shrink that portrait buffer as if it still contained wide side space.
    const height=Math.min(screen.clientHeight,screen.clientWidth/Math.min(aspect,safeAspect));
    canvas.style.width=`${height*aspect}px`;
    canvas.style.height=`${height}px`;
  }
  function rotate(value){
    release();
    document.body.classList.toggle('portrait-rotated',value);
    portrait.setAttribute('aria-pressed',String(value));
    portrait.title=value?'Return to landscape':'Rotate for portrait play';
    portrait.setAttribute('aria-label',portrait.title);
    try{localStorage.setItem('finni-portrait-v1',String(value));}catch{}
    requestAnimationFrame(()=>{fitCanvas();if(ready())canvas.focus({preventScroll:true});});
  }
  portrait.onclick=()=>rotate(!document.body.classList.contains('portrait-rotated'));
  try{if(!phone.matches&&localStorage.getItem('finni-portrait-v1')==='true')rotate(true);}catch{}
  phone.addEventListener('change',()=>{if(phone.matches)rotate(false);});
  new ResizeObserver(fitCanvas).observe(screen);
  // Old preferences belonged to the non-refreshing camera implementation.
  const preferenceKey='finni-camera-v2';
  let revision=0;
  try{const saved=localStorage.getItem(preferenceKey);if(presets[saved])select.value=saved;}catch{}
  function apply(){
    if(!ready())return;
    fitCanvas();
    const [inclination,fov,layback,y,z,scale]=presets[select.value]||presets.classic;
    const current=++revision;
    // These legacy setters only update stored values. Toggling the static
    // prepass invalidates the cached camera; render two dynamic frames before
    // restoring it so the newly selected projection is actually displayed.
    evaluate(`Table1.Inclination=${inclination}:Table1.FieldOfView=${fov}:Table1.Layback=${layback}:Table1.ScaleX=${scale}:Table1.ScaleY=${scale}:Table1.Xlatex=0:Table1.Xlatey=${y}:Table1.Xlatez=${z}:DisableStaticPrerendering=False:DisableStaticPrerendering=True`);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(current===revision&&ready())evaluate('DisableStaticPrerendering=False');
    }));
    try{localStorage.setItem(preferenceKey,select.value);}catch{}
  }
  select.onchange=()=>{
    release();apply();
    if(ready()&&!document.querySelector('.panel:popover-open'))canvas.focus({preventScroll:true});
  };
  return {apply};
}

export function createDmd(){
  const canvas=document.getElementById('dmd');
  // Composite the installed full-colour sprites without filtering the pixel art.
  canvas.width=1024;canvas.height=256;
  const context=canvas.getContext('2d');
  const sprite=new Image();let atlas=null,animations={},last='',latest='';
  let scene='',started=0,firstFrame=0,timer=null;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function stop(){clearTimeout(timer);timer=null;}
  function restart(){stop();scene='';last='';draw(latest);}
  reducedMotion.addEventListener('change',restart);
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stop();else restart();});
  const loaded=Promise.all([
    fetch('/dmd-atlas.json').then(r=>{if(!r.ok)throw Error('DMD sprites missing');return r.json();}),
    fetch('/dmd-animations.json').then(r=>{if(!r.ok)throw Error('DMD animations missing');return r.json();}),
    new Promise((resolve,reject)=>{sprite.onload=resolve;sprite.onerror=reject;sprite.src='/dmd-atlas.png';}),
  ]).then(([data,motion])=>{
    atlas=data;
    // Only play complete loops present in this version of the installed atlas.
    animations=Object.fromEntries(Object.entries(motion).filter(([,spec])=>
      spec.frames?.length&&spec.frame_ms>0&&spec.frames.every(name=>atlas[name])));
    draw(latest);
  }).catch(()=>{document.getElementById('dmd-error').hidden=false;});
  function draw(state){
    latest=state;
    if(!atlas||!state)return;
    const names=state.split('|');
    const background=(names[40]||'bkempty').toLowerCase();
    const base=background.replace(/_anim\d{2}$/, '');
    const now=performance.now();
    if(base!==scene){
      stop();scene=base;started=now;
      firstFrame=Number(background.match(/_anim(\d{2})$/)?.[1]||0);
    }
    const spec=animations[base];
    if(reducedMotion.matches){
      stop();names[40]=base;
    }else if(spec){
      // The browser owns playback; native polling only supplies scene and text.
      // Repeated score updates must not restart an activity's animation.
      const elapsed=now-started;
      names[40]=spec.frames[(firstFrame+Math.floor(elapsed/spec.frame_ms))%spec.frames.length];
      if(timer===null&&!document.hidden){
        timer=setTimeout(()=>{timer=null;draw(latest);},spec.frame_ms-elapsed%spec.frame_ms);
      }
    }
    state=names.join('|');
    if(state===last)return;last=state;
    context.clearRect(0,0,1024,256);context.fillStyle='#100a04';context.fillRect(0,0,1024,256);
    context.imageSmoothingEnabled=false;
    const paint=(name,x,y,w,h)=>{const rect=atlas[String(name).toLowerCase()];if(rect)context.drawImage(sprite,...rect,x*4,y*4,w*4,h*4);};
    paint(names[40],0,0,256,64);
    for(let i=0;i<40;i++)paint(names[i],8+(i%20)*12,i<20?6:34,12,22);
  }
  return {draw,loaded};
}
