// Hold the real table request while the browser downloads the WebAssembly engine.
// With Playwright and its browser installed: node scripts/test-startup-browser.mjs <url> [chromium|webkit]
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const playwright=await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const [base='http://127.0.0.1:8765',engine='chromium']=process.argv.slice(2);
const browser=await playwright[engine].launch();
const releaseTable=Promise.withResolvers();
const tableUrl='**/table.vpx*';

try{
  const page=await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.route(tableUrl,async route=>{
    await releaseTable.promise;
    await route.continue();
  });
  const [,wasm]=await Promise.all([
    page.waitForRequest(tableUrl),
    page.waitForResponse(response=>new URL(response.url()).pathname==='/engine/vpinball.wasm'),
    page.goto(base,{waitUntil:'domcontentloaded'}),
  ]);
  assert.ok(wasm.ok(),'The real WebAssembly download starts before the table is released');
  assert.equal(await wasm.finished(),null,'The WebAssembly download finishes while the table is held');
  const play=page.locator('#play');
  assert.equal(await play.isDisabled(),true,'Start waits for the table');

  releaseTable.resolve();
  await page.waitForFunction(()=>!!window.finni&&!document.getElementById('play').disabled);
  assert.equal(await play.textContent(),'Start game');
  await play.click();
  await page.waitForFunction(()=>document.body.classList.contains('game-in-play'));
  console.log(`PASS (${engine}): engine downloads during a stalled table request, then the real game starts`);
}finally{
  releaseTable.resolve();
  await browser.close();
}
