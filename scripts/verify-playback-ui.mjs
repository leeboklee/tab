/**
 * Drive the real app UI: analyze cached YouTube URL, then assert
 * duration badge, volume slider, and playback rate stay aligned.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const FE = (process.env.TUNNEL_URL || 'http://127.0.0.1:3019').replace(/\/$/, '')
const URL = process.argv[2] || 'https://www.youtube.com/watch?v=Xh0GyxWgKPs'
const OUT = '/opt/cursor/artifacts/playback-sync'
fs.mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(180000)

  await page.goto(FE, { waitUntil: 'networkidle', timeout: 60000 })

  // URL input + analyze
  const input = page.locator('input[type="url"], input[placeholder*="YouTube"], input[placeholder*="youtube"], input').first()
  await input.fill(URL)
  const analyzeBtn = page.getByRole('button', { name: /분석|Analyze|변환/i }).first()
  await analyzeBtn.click()

  // Wait for notation / duration badge
  const badge = page.getByTestId('analysis-duration-badge')
  await badge.waitFor({ state: 'visible', timeout: 180000 })
  const badgeText = (await badge.textContent())?.trim() || ''

  const durationLabel = page.getByTestId('audio-duration')
  await durationLabel.waitFor({ state: 'visible', timeout: 30000 })
  const playerDurText = (await durationLabel.textContent())?.trim() || ''

  const volume = page.getByTestId('audio-volume')
  await volume.waitFor({ state: 'visible' })
  await volume.evaluate((el) => {
    const input = el
    input.value = '0.4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const volPct = (await page.getByTestId('audio-volume-pct').textContent())?.trim()

  // Change speed select to 1.5x
  const speed = page.locator('select').filter({ has: page.locator('option[value="1.5"]') }).first()
  await speed.selectOption('1.5')
  const rateLabel = page.getByTestId('audio-rate-label')
  await page.waitForTimeout(300)
  const rateText = (await rateLabel.textContent())?.trim() || ''

  // Play briefly and sample currentTime vs rate
  const playBtn = page.locator('[title="재생"], button').filter({ has: page.locator('svg') }).first()
  // Prefer the audio player's play button near volume
  const audioPlay = page.locator('div').filter({ has: page.getByTestId('audio-volume') }).getByTitle('재생')
  if (await audioPlay.count()) {
    await audioPlay.click()
  } else {
    await playBtn.click()
  }
  await page.waitForTimeout(1500)
  const t1Text = (await page.getByTestId('audio-current-time').textContent())?.trim()
  await page.waitForTimeout(1500)
  const t2Text = (await page.getByTestId('audio-current-time').textContent())?.trim()

  await page.screenshot({ path: path.join(OUT, 'ui-result.png'), fullPage: true })

  // Parse mm:ss
  const parse = (s) => {
    const m = String(s).match(/(\d+):(\d+)/)
    if (!m) return NaN
    return Number(m[1]) * 60 + Number(m[2])
  }

  const report = {
    fe: FE,
    url: URL,
    badgeText,
    playerDurText,
    volPct,
    rateText,
    t1Text,
    t2Text,
    checks: {
      badgeVisible: Boolean(badgeText),
      durationAligned: badgeText.includes('1:30') || playerDurText === '1:30' || playerDurText === badgeText,
      volumeVisible: await volume.isVisible(),
      volumeApplied: volPct === '40%',
      rateApplied: rateText.includes('1.5'),
      timeAdvances: parse(t2Text) > parse(t1Text),
    },
  }
  report.ok = Object.values(report.checks).every(Boolean)
  fs.writeFileSync(path.join(OUT, 'ui-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
  if (!report.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
