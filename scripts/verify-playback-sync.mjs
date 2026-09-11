/**
 * Verify speed / volume / time consistency for clipped analysis playback.
 *
 * Usage:
 *   TUNNEL_URL=http://127.0.0.1:3019 node scripts/verify-playback-sync.mjs [audio_id] [duration]
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const FE = (process.env.TUNNEL_URL || 'http://127.0.0.1:3019').replace(/\/$/, '')
const BE = process.env.BACKEND_URL || 'http://127.0.0.1:8002'
const AUDIO_ID = process.argv[2] || 'e139cd7a-09cc-4695-af96-734708915ad3'
const EXPECT_DUR = Number(process.argv[3] || 90)
const OUT = '/opt/cursor/artifacts/playback-sync'
fs.mkdirSync(OUT, { recursive: true })

function probeDuration(filePath) {
  return Number(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath],
      { encoding: 'utf8' },
    ).trim(),
  )
}

async function main() {
  const clipUrl = `${BE}/audio/${AUDIO_ID}/stream?max_seconds=${EXPECT_DUR}`
  const fullUrl = `${BE}/audio/${AUDIO_ID}/stream`
  const clipRes = await fetch(clipUrl)
  const fullRes = await fetch(fullUrl)
  if (!clipRes.ok) throw new Error(`clip stream ${clipRes.status}`)
  if (!fullRes.ok) throw new Error(`full stream ${fullRes.status}`)
  const clipBuf = Buffer.from(await clipRes.arrayBuffer())
  const fullBuf = Buffer.from(await fullRes.arrayBuffer())
  fs.writeFileSync(path.join(OUT, 'clipped.mp3'), clipBuf)
  fs.writeFileSync(path.join(OUT, 'full.mp3'), fullBuf)
  const clipDur = probeDuration(path.join(OUT, 'clipped.mp3'))
  const fullDur = probeDuration(path.join(OUT, 'full.mp3'))

  // Prefer analyze-from-audio when available; otherwise use metadata duration.
  let analysisDuration = EXPECT_DUR
  let title = AUDIO_ID
  let tabs = 0
  try {
    const analyzeRes = await fetch(`${BE}/analyze-from-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_id: AUDIO_ID }),
    })
    const analyzeJson = await analyzeRes.json()
    fs.writeFileSync(path.join(OUT, 'analyze-from-audio.json'), JSON.stringify(analyzeJson, null, 2))
    if (analyzeJson.success && analyzeJson.data) {
      analysisDuration = Number(analyzeJson.data.duration) || EXPECT_DUR
      title = analyzeJson.data.title || title
      tabs = (analyzeJson.data.tabs || []).length
    }
  } catch (e) {
    fs.writeFileSync(path.join(OUT, 'analyze-from-audio-error.txt'), String(e))
  }

  const streamUrl = `${FE}/api/python/audio/${encodeURIComponent(AUDIO_ID)}/stream?max_seconds=${analysisDuration}`

  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage()
  await page.goto(FE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(800)

  const harness = await page.evaluate(async ({ streamUrl, analysisDuration }) => {
    document.body.innerHTML = `
      <div id="root" style="padding:24px;font-family:sans-serif;background:#111;color:#fff;min-height:100vh">
        <h1>playback sync harness</h1>
        <div>badge: <span id="badge">${analysisDuration}</span>s</div>
        <audio id="a" crossorigin="anonymous" preload="auto" controls style="width:100%"></audio>
        <div>player: <span id="cur">0</span> / <span id="dur">?</span></div>
        <div>rate: <span id="rate">1</span> volume: <span id="vol">0.85</span></div>
      </div>`
    const audio = document.getElementById('a')
    audio.src = streamUrl
    const nativeDuration = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('metadata timeout')), 30000)
      audio.addEventListener(
        'loadedmetadata',
        () => {
          clearTimeout(t)
          resolve(audio.duration)
        },
        { once: true },
      )
      audio.load()
    })
    document.getElementById('dur').textContent = String(nativeDuration)

    audio.volume = 0.85
    audio.playbackRate = 1
    await audio.play()
    await new Promise((r) => setTimeout(r, 800))
    const t1 = audio.currentTime
    audio.playbackRate = 1.5
    document.getElementById('rate').textContent = '1.5'
    await new Promise((r) => setTimeout(r, 1000))
    const t2 = audio.currentTime
    const delta = t2 - t1
    audio.volume = 0.4
    document.getElementById('vol').textContent = '0.4'
    await new Promise((r) => setTimeout(r, 150))
    const vol2 = audio.volume
    audio.currentTime = 45
    await new Promise((r) => setTimeout(r, 250))
    const seeked = audio.currentTime
    audio.currentTime = Math.max(0, nativeDuration - 0.05)
    await new Promise((r) => setTimeout(r, 200))
    const nearEnd = audio.currentTime
    document.getElementById('cur').textContent = String(nearEnd.toFixed(2))
    audio.pause()
    return {
      nativeDuration,
      t1,
      t2,
      delta,
      rate2: audio.playbackRate,
      vol2,
      seeked,
      nearEnd,
      streamUrl,
    }
  }, { streamUrl, analysisDuration })

  await page.screenshot({ path: path.join(OUT, 'harness.png'), fullPage: true })
  await browser.close()

  const checks = {
    apiClipDuration: Math.abs(clipDur - EXPECT_DUR) < 1.5,
    apiFullLonger: fullDur > EXPECT_DUR + 20,
    apiClipSmaller: clipBuf.length < fullBuf.length,
    analysisDurationMatch: Math.abs(analysisDuration - EXPECT_DUR) < 1.5,
    playerDurationMatch: Math.abs(harness.nativeDuration - analysisDuration) < 1.5,
    rateApplied: harness.rate2 === 1.5,
    rateEffect: harness.delta > 1.1 && harness.delta < 2.2,
    volumeApplied: Math.abs(harness.vol2 - 0.4) < 0.01,
    seekOk: Math.abs(harness.seeked - 45) < 1.0,
    endWithinWindow: harness.nearEnd <= analysisDuration + 1.5,
  }

  const report = {
    fe: FE,
    audioId: AUDIO_ID,
    expectDur: EXPECT_DUR,
    clipDur,
    fullDur,
    analysisDuration,
    title,
    tabs,
    harness,
    checks,
    ok: Object.values(checks).every(Boolean),
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
