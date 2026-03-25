import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('헤드리스: 생성된 악보 섹션이 표시되고 프렛 숫자가 보인다', async ({ page }) => {
  test.setTimeout(120000)

  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ'
  
  // 자동 실행 쿼리로 바로 분석 시작
  const encodedUrl = encodeURIComponent(ytUrl)
  await page.goto(`${APP_URL}/?autostart=1&yt=${encodedUrl}`, { waitUntil: 'domcontentloaded' })

  // 결과 화면으로 전환 대기
  await page.waitForFunction(() => {
    const mainText = document.body ? document.body.innerText : ''
    const hasTab = !!document.querySelector('#tab-notation')
    return mainText.includes('생성된 악보') || mainText.includes('새로운 분석') || hasTab
  }, null, { timeout: 120000 })

  // 악보 영역 가시성 확인
  await expect(page.getByText('생성된 악보')).toBeVisible()

  // 프렛 숫자 존재 여부 확인 (렌더링된 숫자 스팬 기반)
  const fretSpans = page.locator('#tab-notation span.font-mono')
  const count = await fretSpans.count()
  console.log('프렛 스팬 개수:', count)
  await page.screenshot({ path: 'test-results/headless-tab.png' })
  expect(count).toBeGreaterThan(0)
})



