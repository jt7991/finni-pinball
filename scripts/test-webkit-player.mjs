// Safari-engine compatibility: real VPX/WASM, not an engine fixture.
// npm install --prefix .tools/iphone-webkit playwright
// node .tools/iphone-webkit/node_modules/playwright/cli.js install webkit
// PLAYWRIGHT_MODULE may point to that installation's index.mjs.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {webkit,devices}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const [base='http://127.0.0.1:8768',output='.work/webkit-review']=process.argv.slice(2);
await mkdir(output,{recursive:true});
const browser=await webkit.launch();
const results=[];
try{
  const context=await browser.newContext({...devices['iPhone 13'],reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(120000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.webkitTest={errors:[],programs:0,draws:0};
    const proto=WebGL2RenderingContext.prototype;
    for(const name of ['compileShader','linkProgram']){
      const original=proto[name];proto[name]=function(object){
        original.call(this,object);
        if(name==='linkProgram')webkitTest.programs++;
        const valid=name==='compileShader'?this.getShaderParameter(object,this.COMPILE_STATUS):this.getProgramParameter(object,this.LINK_STATUS);
        if(!valid)webkitTest.errors.push(name==='compileShader'?this.getShaderInfoLog(object):this.getProgramInfoLog(object));
      };
    }
    for(const name of ['drawArrays','drawElements']){
      const original=proto[name];proto[name]=function(...args){webkitTest.draws++;return original.apply(this,args)};
    }
  });
  await page.goto(base);
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.equal(await page.locator('#play').textContent(),'Start game',await page.locator('#loading').textContent());
  for(const viewport of [{width:375,height:548},{width:844,height:320},{width:390,height:664}]){
    await page.setViewportSize(viewport);
    const start=await page.locator('#play').boundingBox();
    assert.ok(start&&start.y>=0&&start.y+start.height<=viewport.height,'Start stays reachable with browser bars or in landscape');
  }
  const copySource=(await readFile(new URL('./check-framebuffer-copy.js',import.meta.url),'utf8')).replace('export async function','async function');
  assert.equal(await page.evaluate(async source=>Function(`${source};return checkFramebufferCopy()`)(),copySource),true);
  await page.locator('#play').tap();
  await page.waitForFunction(()=>document.body.classList.contains('playing')||document.body.classList.contains('engine-error'));
  assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('engine-error')),false,await page.locator('#loading').textContent());
  await page.waitForFunction(()=>webkitTest.draws>100);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#camera-view').inputValue(),'balanced');
  assert.deepEqual(await page.evaluate(()=>webkitTest.errors),[],'All native shaders compile in WebKit');
  async function angles(){
    return page.evaluate(()=>{
      finni.evaluate('Debug.Print "WEBKIT_ANGLES|" & LeftFlipper.CurrentAngle & "|" & RightFlipper.CurrentAngle');
      const line=document.getElementById('log').textContent.split('\n').filter(s=>s.includes('WEBKIT_ANGLES|')).at(-1);
      return line.split('WEBKIT_ANGLES|')[1].split('|').map(value=>parseFloat(value));
    });
  }
  const resting=await angles();
  async function pointer(type,id,action){await page.locator(`[data-action=${action}]`).dispatchEvent(type,{pointerId:id,pointerType:'touch',button:0,bubbles:true,cancelable:true});}
  await pointer('pointerdown',41,'left');await pointer('pointerdown',42,'right');
  await page.waitForTimeout(300);
  const held=await angles();
  assert.ok(held.every((value,i)=>Math.abs(value-resting[i])>10),`Independent pointers move both real native flippers: ${JSON.stringify({resting,held,pressed:await page.locator('.pressed').count()})}`);
  await pointer('pointerup',41,'left');await pointer('pointercancel',42,'right');
  await page.waitForTimeout(300);
  const released=await angles();
  assert.ok(released.every((value,i)=>Math.abs(value-resting[i])<.1),'Release and cancellation restore both flippers');
  await pointer('pointerdown',44,'left');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.locator('.pressed').count(),0,'Page exit releases held controls');
  await page.locator('[data-action=launch]').dispatchEvent('pointerdown',{pointerId:43,pointerType:'touch',bubbles:true,cancelable:true});
  await page.waitForTimeout(800);
  await page.locator('[data-action=launch]').dispatchEvent('pointerup',{pointerId:43,pointerType:'touch',bubbles:true,cancelable:true});
  await page.waitForTimeout(500);
  await page.screenshot({path:resolve(output,'iphone-portrait.png')});
  await page.locator('#fullscreen').tap();
  if(!await page.evaluate(()=>document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)){
    assert.match(await page.locator('#screen-message').textContent(),/does not support full screen/);
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('engine-error')),false,'Missing fullscreen API never prevents play');
  }
  await page.locator('#touch-help').tap();
  await page.getByText('Settings & camera',{exact:true}).tap();
  assert.equal(await page.locator('#controls-panel').evaluate(el=>el.matches(':popover-open')),true);
  await page.locator('#camera-view').selectOption('topdown');
  await page.locator('[aria-label="Close controls"]').tap();
  await page.locator('#dismiss-touch-guide').tap();
  await page.evaluate(()=>document.getElementById('screen-message').hidden=true);
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(600);
  await page.screenshot({path:resolve(output,'iphone-landscape.png')});
  for(const viewport of [{width:375,height:548},{width:430,height:739},{width:844,height:320}]){
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    const layout=await page.evaluate(()=>{
      const bounds=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
      return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,help:bounds('touch-help'),footer:bounds('touch'),dmd:bounds('dmd')};
    });
    assert.ok(layout.scroll<=layout.width,'No horizontal page overflow');
    for(const name of ['help','footer','dmd'])assert.ok(layout[name].x>=-1&&layout[name].y>=-1&&layout[name].right<=layout.width+1&&layout[name].bottom<=layout.height+1,`${name} fits ${JSON.stringify(viewport)}`);
    results.push({viewport,layout});
  }
  assert.deepEqual(errors,[],'No uncaught WebKit runtime errors');
  assert.deepEqual(await page.evaluate(()=>webkitTest.errors),[],'No shader failures after camera/resize changes');
  const rendering=await page.evaluate(()=>({programs:webkitTest.programs,draws:webkitTest.draws,density:devicePixelRatio,canvas:[canvas.width,canvas.height],fullscreenAPI:typeof document.documentElement.requestFullscreen,audio:typeof AudioContext,ua:navigator.userAgent}));
  await writeFile(resolve(output,'result.json'),JSON.stringify({engine:'Playwright WebKit on Windows; iPhone emulation, not iOS or physical Apple GPU',rendering,results},null,2));
  console.log('PASS: WebKit real VPX startup, GPU cache copy, native shaders, two independent flipper pointers, cancel/release, launch, settings/camera, portrait/landscape and short phone layouts. NOT physical iPhone certification.');
  console.log(JSON.stringify(rendering));
}finally{await browser.close()}
