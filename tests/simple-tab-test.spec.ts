import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('타브 악보 렌더링 확인', async ({ page }) => {
  test.setTimeout(60000)
  
  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ'
  
  // 자동 실행 쿼리로 바로 분석 시작
  const encodedUrl = encodeURIComponent(ytUrl)
  await page.goto(`${APP_URL}/?autostart=1&yt=${encodedUrl}`, { waitUntil: 'domcontentloaded' })

  // 결과 화면 전환 대기(텍스트/버튼/타브 영역 중 하나로 판별)
  await page.waitForFunction(() => {
    const mainText = document.body ? document.body.innerText : ''
    const hasTab = !!document.querySelector('#tab-notation')
    return mainText.includes('생성된 악보') || mainText.includes('새로운 분석') || hasTab
  }, null, { timeout: 60000 })
  
  // 타브 악보 영역 확인
  await expect(page.getByText('생성된 악보')).toBeVisible({ timeout: 15000 })
  
  // 타브 숫자 확인
  const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
  const fretCount = await fretNumbers.count()
  
  console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
  
  if (fretCount > 0) {
    console.log('✅ 타브 악보가 성공적으로 렌더링되었습니다!')
    // 첫 번째 프렛 숫자 확인
    const firstFret = await fretNumbers.first().textContent()
    console.log(`첫 번째 프렛: ${firstFret}`)
  } else {
    console.log('❌ 타브 악보가 렌더링되지 않았습니다.')
    // 페이지 스크린샷 저장
    await page.screenshot({ path: 'test-results/tab-rendering-issue.png' })
  }
  
  // 최소한 하나의 프렛 숫자가 있어야 함
  expect(fretCount).toBeGreaterThan(0)
})

