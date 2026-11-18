export function createViews(evaluate, ready){
  const select=document.getElementById('camera-view');
  const picker=select.closest('label');
  const desktopAnchor=document.createComment('camera picker');picker.before(desktopAnchor);
  const phone=matchMedia('(max-width:650px)');
  function placePicker(){
    if(phone.matches){document.getElementById('camera-controls').append(picker);picker.classList.add('in-controls');}
    else{desktopAnchor.after(picker);picker.classList.remove('in-controls');}
  }
  phone.addEventListener('change',placePicker);placePicker();
  const presets={classic:[48,48,5,50,-350],balanced:[30,40,0,30,-350],topdown:[0,10,0,0,-350]};
  select.value='topdown';
  // Old preferences belonged to the non-refreshing camera implementation.
  const preferenceKey='finni-camera-v2';
  let revision=0;
  try{const saved=localStorage.getItem(preferenceKey);if(presets[saved])select.value=saved;}catch{}
  function apply(){
    if(!ready())return;
    const [inclination,fov,layback,y,z]=presets[select.value]||presets.classic;
    const current=++revision;
    // These legacy setters only update stored values. Toggling the static
    // prepass invalidates the cached camera; render two dynamic frames before
    // restoring it so the newly selected projection is actually displayed.
    evaluate(`Table1.Inclination=${inclination}:Table1.FieldOfView=${fov}:Table1.Layback=${layback}:Table1.Xlatex=0:Table1.Xlatey=${y}:Table1.Xlatez=${z}:DisableStaticPrerendering=False:DisableStaticPrerendering=True`);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(current===revision&&ready())evaluate('DisableStaticPrerendering=False');
    }));
    try{localStorage.setItem(preferenceKey,select.value);}catch{}
  }
  select.onchange=apply;
  return {apply};
}

export function createDmd(){
  const canvas=document.getElementById('dmd');
  // This table uses full-colour bitmap flashers, not hardware DMD pixels.
  // Composite the original sprites once at high resolution. No dot texture,
  // sampling pass, synthetic mask, or additive washout belongs in this path.
  canvas.width=1024;canvas.height=256;
  const context=canvas.getContext('2d');
  const sprite=new Image();let atlas=null,last='';
  const loaded=Promise.all([fetch('/dmd-atlas.json').then(r=>{if(!r.ok)throw Error('DMD sprites missing');return r.json();}),new Promise((resolve,reject)=>{sprite.onload=resolve;sprite.onerror=reject;sprite.src='/dmd-atlas.png';})]).then(([data])=>{atlas=data;}).catch(()=>{document.getElementById('dmd-error').hidden=false;});
  function draw(state){
    if(!atlas||state===last)return;last=state;
    const names=state.split('|');context.clearRect(0,0,1024,256);context.fillStyle='#100a04';context.fillRect(0,0,1024,256);
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    const paint=(name,x,y,w,h)=>{const rect=atlas[String(name).toLowerCase()];if(rect)context.drawImage(sprite,...rect,x*4,y*4,w*4,h*4);};
    paint(names[40]||'bkempty',0,0,256,64);
    for(let i=0;i<40;i++)paint(names[i],8+(i%20)*12,i<20?6:34,12,22);
  }
  return {draw,loaded};
}
