import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('실제 오디오 분석 후 타브 숫자가 렌더링된다', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })

  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)

  const radio = page.locator('input[name=analysis-type]').last()
  if (await radio.isEnabled()) {
    await radio.check()
  }

  await page.getByRole('button', { name: /타브/ }).click()

  await page.waitForSelector('h3:has-text("생성된 악보")', { timeout: 120000 })

  const anyFret = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
  await expect(anyFret.first()).toBeVisible({ timeout: 30000 })
})
