// Exercise the packaged table's music cues and real browser media playback.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const playwright = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const [base = 'http://127.0.0.1:8765', engine = 'chromium'] = process.argv.slice(2);
const browser = await playwright[engine].launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 760}});
  page.setDefaultTimeout(90_000);
  await page.addInitScript(() => {
    window.musicPauses = new Map();
    window.musicStarts = new Map();
    const context = window.AudioContext ?? window.webkitAudioContext;
    if (context) {
      const mediaSource = context.prototype.createMediaElementSource;
      context.prototype.createMediaElementSource = function (element) {
        if (element === window.soundtrack) window.soundtrackContext = this;
        return mediaSource.call(this, element);
      };
    }
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const audio = new target(...args);
        audio.pause = function () {
          if (!this.paused) window.musicPauses.set(this.src, this.currentTime);
          return target.prototype.pause.call(this);
        };
        audio.play = function () {
          window.musicStarts.set(this.src, this.currentTime);
          return target.prototype.play.call(this);
        };
        return window.soundtrack = audio;
      },
    });
  });
  const track = path => '/music/' + path + '.mp3';
  const files = new Set();
  page.on('response', response => {
    if (response.ok()) files.add(new URL(response.url()).pathname);
  });
  const state = () => page.evaluate(() => {
    const {src, paused, currentTime, loop} = window.soundtrack;
    return {src, paused, currentTime, loop};
  });
  async function assertTrack(name) {
    const {src} = await state();
    if (src.startsWith('blob:')) assert(files.has(track(name)), name);
    else assert.equal(new URL(src).pathname, track(name));
  }
  const resumeTimes = src => page.evaluate(src => ({
    pausedAt: window.musicPauses.get(src), resumedAt: window.musicStarts.get(src),
  }), src);
  const script = text => page.evaluate(text => {
    const result = window.finni.evaluate(text);
    if (result !== 1) throw Error('Table rejected: ' + text + ' (' + result + ')');
  }, text);
  const playing = (previous = '') => page.waitForFunction(previous => {
    const audio = window.soundtrack;
    return (audio?.src.startsWith('blob:') || audio?.src.includes('/music/')) && audio.src !== previous &&
      !audio.paused && audio.currentTime > 0;
  }, previous);

  await page.goto(base);
  await page.getByRole('button', {name: 'Start game', exact: true}).click();
  await playing();
  assert(await page.evaluate(() => window.soundtrackContext
    ? window.soundtrackContext.state === 'running' : window.soundtrack.volume > 0));
  await assertTrack('mu_hellhouse1');
  assert((await state()).loop);
  await page.waitForFunction(() => document.body.classList.contains('ball-in-plunger'));
  const title = await state();

  await page.keyboard.down('Enter');
  await page.waitForTimeout(600);
  await page.keyboard.up('Enter');
  await page.waitForFunction(() => !document.body.classList.contains('ball-in-plunger'));
  const launched = await state();
  assert.equal(launched.src, title.src);
  assert(launched.currentTime > title.currentTime);

  await script('bMechSuitMBStarted=True:bBerserker=True:ChangeSong');
  assert.equal((await state()).src, title.src);
  assert.equal((await state()).paused, false);
  await script('bMechSuitMBStarted=False:bBerserker=False:Battle(CurrentPlayer,0)=1:ChangeSong');
  await playing(title.src);
  await assertTrack('mu_juggernaut');
  const task = await state();
  await script('Battle(CurrentPlayer,0)=2:ChangeSong');
  assert.equal((await state()).src, task.src);

  await script('bLilDPMB=True:bNinjaMB=True:ChangeSong');
  await playing(task.src);
  await assertTrack('mu_ninjamb');
  const friendship = await state();
  await script('bNinjaMB=False:ChangeSong');
  await playing(friendship.src);
  await assertTrack('mu_multiball');
  const cake = await state();
  await script('bLilDPMB=False:ChangeSong');
  await playing(cake.src);
  const resumedTask = await state();
  assert.equal(resumedTask.src, task.src);
  const taskTimes = await resumeTimes(task.src);
  assert(taskTimes.pausedAt > 0);
  assert(Math.abs(taskTimes.resumedAt - taskTimes.pausedAt) < 0.01);

  await script('Battle(CurrentPlayer,0)=0:ChangeSong');
  await playing(task.src);
  const resumed = await state();
  assert.equal(resumed.src, title.src);
  const titleTimes = await resumeTimes(title.src);
  assert(titleTimes.pausedAt >= launched.currentTime);
  assert(Math.abs(titleTimes.resumedAt - titleTimes.pausedAt) < 0.01);

  await script('FinniMusicPaused=True:ChangeSong');
  const paused = await state();
  assert(paused.paused);
  await page.waitForTimeout(250);
  assert((await state()).paused);
  await script('FinniMusicPaused=False:ChangeSong');
  await playing();
  const bonusTimes = await resumeTimes(paused.src);
  assert(Math.abs(bonusTimes.resumedAt - bonusTimes.pausedAt) < 0.01);
  assert((await state()).currentTime + 0.05 >= bonusTimes.pausedAt);
  await page.evaluate(() => { window.soundtrack.currentTime = window.soundtrack.duration - 0.15; });
  await page.waitForFunction(() => !window.soundtrack.paused && window.soundtrack.currentTime < 1);
  console.log(`PASS (${engine}): launch continuity, silent modes, soundtrack priority, exact-position resume, bonus pause and looping`);
} finally {
  await browser.close();
}
