import { chromium } from 'playwright';
import fs from 'fs';

const TUNNEL = process.env.TUNNEL;
const songs = JSON.parse(fs.readFileSync('/tmp/hits3-final.json', 'utf8'));
const out = '/opt/cursor/artifacts/hits3';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const all = [];

for (const song of songs) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const steps = [];
  const step = (name, ok, detail) => {
    steps.push({ name, ok, detail });
    console.log(ok ? 'PASS' : 'FAIL', song.slug, name, detail || '');
  };

  await page.goto(TUNNEL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('body').innerText()).includes('연결됨')) break;
    await page.waitForTimeout(400);
  }
  step('connected', (await page.locator('body').innerText()).includes('연결됨'));

  await page.locator('input[placeholder*="youtube" i], input[placeholder*="http"]').first().fill(song.url);
  await page.getByRole('button', { name: '분석', exact: true }).click();

  let body = '';
  let done = false;
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(2000);
    body = await page.locator('body').innerText();
    if (/분석 중/.test(body)) continue;
    if (/음원 재생|분석 완료|타브 악보/i.test(body)) {
      done = true;
      break;
    }
    if (/실패|차단|미리보기/.test(body) && i > 3) break;
  }
  await page.screenshot({ path: `${out}/${song.slug}-result.png`, fullPage: true });
  step('analyze_ui', done && /실제 오디오 분석 완료|분석 완료/.test(body) && !/실패 후 미리보기/.test(body), body.replace(/\s+/g, ' ').slice(0, 200));

  const tabBtn = page.getByRole('button', { name: /타브 악보/ }).first();
  if (await tabBtn.count()) await tabBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  const tabCount = await page.locator('#tab-notation').count();
  const tabText = tabCount ? await page.locator('#tab-notation').innerText() : '';
  const frets = (tabText.match(/\b[1-9]\d?\b/g) || []).length;
  step('tab_screen', tabCount > 0 && frets >= 5, `frets=${frets}`);

  const play = page.locator('button[title="재생"]').first();
  if (await play.count()) {
    await play.click();
    await page.waitForTimeout(2000);
  }

  const audioStats = await page.evaluate(async () => {
    const audio = document.querySelector('audio');
    if (!audio) return { error: 'no audio' };
    const info = { src: audio.currentSrc || audio.src, duration: audio.duration };
    try {
      if (audio.paused) await audio.play();
      await new Promise((r) => setTimeout(r, 1500));
      info.after = { paused: audio.paused, currentTime: audio.currentTime };
      const buf = await (await fetch(audio.currentSrc || audio.src)).arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const ch = decoded.getChannelData(0);
      const sr = decoded.sampleRate;
      const start = Math.min(ch.length - 1, Math.floor(sr * 10));
      const end = Math.min(ch.length, start + sr * 2);
      let sum = 0, peak = 0, n = 0;
      for (let i = start; i < end; i++) {
        const v = Math.abs(ch[i]);
        sum += v * v;
        if (v > peak) peak = v;
        n++;
      }
      await ctx.close();
      info.decode = { duration: decoded.duration, rms: Math.sqrt(sum / Math.max(1, n)), peak, audible: Math.sqrt(sum / Math.max(1, n)) > 0.01, bytes: buf.byteLength };
    } catch (e) {
      info.decodeError = String(e);
    }
    return info;
  });

  step('audio_playing', Boolean(audioStats.after && audioStats.after.currentTime > 0.2), JSON.stringify(audioStats.after));
  step('audio_audible', Boolean(audioStats.decode?.audible), JSON.stringify(audioStats.decode || audioStats.decodeError));
  await page.screenshot({ path: `${out}/${song.slug}-playing.png`, fullPage: true });

  all.push({ song, steps, audioStats, pass: steps.every((s) => s.ok) });
  await page.close();
}

fs.writeFileSync(`${out}/ui-e2e-summary.json`, JSON.stringify(all, null, 2));
console.log('FINAL', all.map((a) => ({ slug: a.song.slug, pass: a.pass, fails: a.steps.filter((s) => !s.ok).map((s) => s.name) })));
await browser.close();
process.exit(all.every((a) => a.pass) ? 0 : 1);
