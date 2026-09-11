/**
 * Verify speed / volume / time consistency for a cached analyze result.
 * Usage: node scripts/verify-playback-sync.mjs [audio_id] [analysis_duration]
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const TUNNEL =
  process.env.TUNNEL_URL ||
  (fs.existsSync('/tmp/cloudflared-quick.log')
    ? (fs.readFileSync('/tmp/cloudflared-quick.log', 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/) || [])[0]
    : null) ||
  'http://127.0.0.1:3019'

const AUDIO_ID = process.argv[2] || 'e139cd7a-09cc-4695-af96-734708915ad3'
const ANALYSIS_DURATION = Number(process.argv[3] || 90)
const OUT = '/opt/cursor/artifacts/playback-sync'
fs.mkdirSync(OUT, { recursive: true })

const base = TUNNEL.replace(/\/$/, '')

async function main() {
  // API-level clip check first
  const clipRes = await fetch(`${base}/api/python/audio/${AUDIO_ID}/stream?max_seconds=${ANALYSIS_DURATION}`)
  const clipBuf = Buffer.from(await clipRes.arrayBuffer())
  fs.writeFileSync(path.join(OUT, 'clipped.mp3'), clipBuf)
  const fullRes = await fetch(`${base}/api/python/audio/${AUDIO_ID}/stream`)
  const fullBuf = Buffer.from(await fullRes.arrayBuffer())
  fs.writeFileSync(path.join(OUT, 'full.mp3'), fullBuf)

  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  })
  const page = await browser.newPage()

  // Inject a minimal result page by analyzing from cache via UI is slow;
  // instead hit local page and inject NotationViewer-like player harness.
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const harness = await page.evaluate(
    async ({ audioId, analysisDuration, apiBase }) => {
      const streamUrl = `${apiBase}/audio/${encodeURIComponent(audioId)}/stream?max_seconds=${analysisDuration}`

      // Build a tiny DOM player mirroring AdvancedAudioPlayer contracts
      document.body.innerHTML = `
        <div id="root" style="padding:24px;font-family:sans-serif;background:#111;color:#fff;min-height:100vh">
          <h1>playback sync harness</h1>
          <div>badge duration: <span id="badge">${analysisDuration}</span>s</div>
          <audio id="a" src="${streamUrl}" preload="auto" controls style="width:100%"></audio>
          <div>player: <span id="cur">0</span> / <span id="dur">?</span></div>
          <div>rate: <span id="rate">1</span></div>
          <div>volume: <span id="vol">0.85</span></div>
          <button id="play">play</button>
          <button id="rate15">1.5x</button>
          <button id="vol40">vol 40%</button>
          <button id="seek45">seek 45s</button>
        </div>
      `

      const audio = document.getElementById('a')
      const waitMeta = () =>
        new Promise((resolve, reject) => {
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

      const nativeDuration = await waitMeta()
      document.getElementById('dur').textContent = String(nativeDuration)

      audio.volume = 0.85
      audio.playbackRate = 1

      const measure = async () => {
        // play a bit and sample
        await audio.play()
        await new Promise((r) => setTimeout(r, 1200))
        const t1 = audio.currentTime
        const rate1 = audio.playbackRate
        const vol1 = audio.volume

        audio.playbackRate = 1.5
        document.getElementById('rate').textContent = '1.5'
        await new Promise((r) => setTimeout(r, 1000))
        const t2 = audio.currentTime
        const rate2 = audio.playbackRate
        const elapsedWall = 1.0
        const delta = t2 - t1

        audio.volume = 0.4
        document.getElementById('vol').textContent = '0.4'
        await new Promise((r) => setTimeout(r, 200))
        const vol2 = audio.volume

        audio.currentTime = 45
        await new Promise((r) => setTimeout(r, 300))
        const seeked = audio.currentTime

        // ensure cannot meaningfully exceed analysis window in clipped file
        audio.currentTime = Math.max(0, nativeDuration - 0.05)
        await new Promise((r) => setTimeout(r, 200))
        const nearEnd = audio.currentTime

        audio.pause()
        return {
          nativeDuration,
          badge: analysisDuration,
          t1,
          t2,
          delta,
          elapsedWall,
          rate1,
          rate2,
          vol1,
          vol2,
          seeked,
          nearEnd,
          streamUrl,
        }
      }

      return measure()
    },
    { audioId: AUDIO_ID, analysisDuration: ANALYSIS_DURATION, apiBase: `${base}/api/python` },
  )

  await page.screenshot({ path: path.join(OUT, 'harness.png'), fullPage: true })

  const durationMatch = Math.abs(harness.nativeDuration - ANALYSIS_DURATION) < 1.5
  const rateApplied = harness.rate2 === 1.5
  // at 1.5x, ~1s wall should advance ~1.2-1.8s of media (allow jitter)
  const rateEffect = harness.delta > 1.1 && harness.delta < 2.2
  const volumeApplied = Math.abs(harness.vol2 - 0.4) < 0.01
  const seekOk = Math.abs(harness.seeked - 45) < 1.0
  const endWithinWindow = harness.nearEnd <= ANALYSIS_DURATION + 1.5

  const report = {
    tunnel: base,
    audioId: AUDIO_ID,
    analysisDuration: ANALYSIS_DURATION,
    clipBytes: clipBuf.length,
    fullBytes: fullBuf.length,
    clipSmaller: clipBuf.length < fullBuf.length,
    harness,
    checks: {
      durationMatch,
      rateApplied,
      rateEffect,
      volumeApplied,
      seekOk,
      endWithinWindow,
      clipSmaller: clipBuf.length < fullBuf.length,
    },
  }
  report.ok = Object.values(report.checks).every(Boolean)
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
  if (!report.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
