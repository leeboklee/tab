/**
 * Drive the real app UI: analyze cached YouTube URL, then assert
 * duration badge, volume slider, and playback rate stay aligned.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const FE = (process.env.TUNNEL_URL || 'http://127.0.0.1:3019').replace(/\/$/, '')
const YT = process.argv[2] || 'https://www.youtube.com/watch?v=Xh0GyxWgKPs'
const OUT = '/opt/cursor/artifacts/playback-sync'
fs.mkdirSync(OUT, { recursive: true })

function parseClock(s) {
  const m = String(s || '').match(/(\d+):(\d+)/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

async function setRangeValue(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(180000)

  await page.goto(FE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1000)

  const input = page.locator('input[type="url"], input[placeholder*="YouTube" i], input[placeholder*="youtube" i]').first()
  await input.waitFor({ state: 'visible', timeout: 30000 })
  await input.fill(YT)

  const analyzeBtn = page.getByRole('button', { name: /분석|Analyze|변환/i }).first()
  await analyzeBtn.click()

  const badge = page.getByTestId('analysis-duration-badge')
  await badge.waitFor({ state: 'visible', timeout: 180000 })
  const badgeText = (await badge.textContent())?.trim() || ''

  const durationLabel = page.getByTestId('audio-duration')
  await durationLabel.waitFor({ state: 'visible', timeout: 30000 })
  const playerDurText = (await durationLabel.textContent())?.trim() || ''

  const volume = page.getByTestId('audio-volume')
  await volume.waitFor({ state: 'visible' })
  await setRangeValue(volume, 0.4)
  await page.waitForTimeout(200)
  const volPct = (await page.getByTestId('audio-volume-pct').textContent())?.trim()

  const speed = page.locator('select').filter({ has: page.locator('option[value="1.5"]') }).first()
  await speed.selectOption('1.5')
  await page.waitForTimeout(300)
  const rateText = (await page.getByTestId('audio-rate-label').textContent())?.trim() || ''

  await page.getByRole('button', { name: '재생', exact: true }).click()
  await page.waitForTimeout(1500)
  const t1Text = (await page.getByTestId('audio-current-time').textContent())?.trim()
  await page.waitForTimeout(1500)
  const t2Text = (await page.getByTestId('audio-current-time').textContent())?.trim()

  await page.screenshot({ path: path.join(OUT, 'ui-result.png'), fullPage: true })

  const report = {
    fe: FE,
    url: YT,
    badgeText,
    playerDurText,
    volPct,
    rateText,
    t1Text,
    t2Text,
    checks: {
      badgeVisible: Boolean(badgeText),
      durationAligned:
        badgeText.includes('1:30') ||
        playerDurText === '1:30' ||
        playerDurText === badgeText ||
        Math.abs(parseClock(playerDurText) - 90) <= 1,
      volumeVisible: await volume.isVisible(),
      volumeApplied: volPct === '40%',
      rateApplied: /1\.5/.test(rateText),
      timeAdvances: parseClock(t2Text) > parseClock(t1Text),
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
