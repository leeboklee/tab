import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('헤드리스: 생성된 악보 섹션이 표시되고 프렛 숫자가 보인다', async ({ page }) => {
  test.setTimeout(120000)

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })

  // URL 입력
  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)

  // 메타데이터 기반(기본)으로 실행
  await page.getByRole('button', { name: /타브/ }).click()

  // 결과 화면으로 전환 대기
  await page.waitForSelector('text=생성된 악보', { timeout: 60000 })

  // 악보 영역 가시성 확인
  await expect(page.getByText('생성된 악보')).toBeVisible()

  // 프렛 숫자 존재 여부 확인 (렌더링된 숫자 스팬 기반)
  const fretSpans = page.locator('#tab-notation span.font-mono')
  const count = await fretSpans.count()
  console.log('프렛 스팬 개수:', count)
  await page.screenshot({ path: 'test-results/headless-tab.png' })
  expect(count).toBeGreaterThan(0)
})


