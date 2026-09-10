import { chromium } from 'playwright';
import fs from 'fs';

const TUNNEL = process.env.TUNNEL;
const out = '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const steps = [];
const step = (name, ok, detail) => {
  steps.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', name, detail || '');
};

await page.goto(TUNNEL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/goal-01-home.png`, fullPage: true });
step('home', true, await page.title());

for (let i = 0; i < 30; i++) {
  const t = await page.locator('body').innerText();
  if (t.includes('연결됨')) break;
  await page.waitForTimeout(500);
}
const body0 = await page.locator('body').innerText();
step('pipeline_connected', body0.includes('연결됨'), body0.replace(/\s+/g, ' ').slice(0, 140));

await page.locator('input[placeholder*="youtube" i], input[placeholder*="http"]').first()
  .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await page.getByRole('button', { name: '분석', exact: true }).click();

let body1 = '';
let done = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2000);
  body1 = await page.locator('body').innerText();
  if (/분석 중/.test(body1)) {
    console.log('wait', (i + 1) * 2, 's analyzing');
    continue;
  }
  if (/음원 재생|분석 완료|타브 악보|Never Gonna|Rick Astley/i.test(body1)) {
    done = true;
    break;
  }
  if (/실패|차단|업로드해|미리보기/.test(body1) && i > 2) break;
}
await page.screenshot({ path: `${out}/goal-02-result.png`, fullPage: true });
step('analyze_ui', done, body1.replace(/\s+/g, ' ').slice(0, 280));
step('real_audio_mode', /실제 오디오 분석 완료|분석 완료/.test(body1) && !/실패 후 미리보기/.test(body1), 'mode');
step('has_player_label', body1.includes('음원 재생'), 'player');
step('has_tab_label', /타브 악보|오선보/.test(body1), 'notation');

// Click tab view if needed
const tabBtn = page.getByRole('button', { name: /타브 악보/ }).first();
if (await tabBtn.count()) await tabBtn.click().catch(() => {});
await page.waitForTimeout(500);

const tabCount = await page.locator('#tab-notation').count();
const tabText = tabCount ? await page.locator('#tab-notation').innerText() : '';
const fretHits = (tabText.match(/\b[1-9]\d?\b/g) || []).length;
step('tab_dom', tabCount > 0 && /E[\s\S]*B[\s\S]*G/.test(tabText), `frets=${fretHits} snip=${tabText.slice(0, 80).replace(/\s+/g, ' ')}`);
step('tab_has_notes', fretHits >= 10, `fret_numbers=${fretHits}`);

// Play audio
const play = page.locator('button[title="재생"]').first();
if (await play.count()) {
  await play.click();
  await page.waitForTimeout(2500);
}

const audioStats = await page.evaluate(async () => {
  const audio = document.querySelector('audio');
  if (!audio) return { error: 'no audio element' };
  const info = {
    src: audio.currentSrc || audio.src,
    readyState: audio.readyState,
    paused: audio.paused,
    currentTime: audio.currentTime,
    duration: audio.duration,
    error: audio.error ? audio.error.code : null,
  };
  try {
    if (audio.paused) {
      await audio.play();
      await new Promise((r) => setTimeout(r, 1500));
    }
    info.afterPlay = { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration };
    const res = await fetch(audio.currentSrc || audio.src);
    const buf = await res.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const ch = decoded.getChannelData(0);
    const sr = decoded.sampleRate;
    const start = Math.min(ch.length - 1, Math.floor(sr * 15));
    const end = Math.min(ch.length, start + sr * 2);
    let sum = 0;
    let peak = 0;
    let n = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(ch[i]);
      sum += v * v;
      if (v > peak) peak = v;
      n++;
    }
    const rms = Math.sqrt(sum / Math.max(1, n));
    await ctx.close();
    info.decode = { bytes: buf.byteLength, duration: decoded.duration, rms, peak, audible: rms > 0.01 };
  } catch (e) {
    info.decodeError = String(e);
  }
  return info;
});

step('audio_src', Boolean(audioStats.src), String(audioStats.src || audioStats.error).slice(0, 160));
step('audio_playing', Boolean(audioStats.afterPlay && audioStats.afterPlay.currentTime > 0.2), JSON.stringify(audioStats.afterPlay));
step('audio_audible', Boolean(audioStats.decode?.audible), JSON.stringify(audioStats.decode || audioStats.decodeError));
step('audio_duration_ok', Number(audioStats.decode?.duration || audioStats.duration || 0) > 60, String(audioStats.decode?.duration || audioStats.duration));

await page.screenshot({ path: `${out}/goal-03-playing.png`, fullPage: true });
fs.writeFileSync(`${out}/goal-e2e.json`, JSON.stringify({ steps, audioStats, logs: logs.slice(-40), tunnel: TUNNEL }, null, 2));
console.log('SUMMARY', JSON.stringify(steps, null, 2));
await browser.close();
process.exit(steps.some((s) => !s.ok) ? 1 : 0);
