import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('최종 타브 악보 렌더링 확인', async ({ page }) => {
  test.setTimeout(120000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력
  const ytUrl = 'https://youtu.be/dQw4w9WgXcQ'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  
  // 실제 오디오 분석 선택
  const realAnalysisRadio = page.locator('input[name=analysis-type]').last()
  await realAnalysisRadio.check()
  
  // 분석 시작
  await page.getByRole('button', { name: /타브/ }).click()
  
  // 분석 완료 대기
  await page.waitForSelector('text=실제 오디오 분석 결과', { timeout: 60000 })
  
  // 타브 악보 섹션 확인
  const tabSection = page.locator('text=생성된 악보')
  await expect(tabSection).toBeVisible()
  
  // 타브 숫자 확인
  const fretNumbers = page.locator('#tab-notation').locator('text=/\\b[0-9]\\b/')
  const fretCount = await fretNumbers.count()
  
  console.log(`발견된 프렛 숫자 개수: ${fretCount}`)
  
  if (fretCount > 0) {
    console.log('✅ 타브 악보가 성공적으로 렌더링되었습니다!')
    
    // 첫 3개 프렛 숫자 확인
    for (let i = 0; i < Math.min(3, fretCount); i++) {
      const fretText = await fretNumbers.nth(i).textContent()
      console.log(`프렛 ${i + 1}: ${fretText}`)
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/successful-tab-rendering.png' })
  } else {
    console.log('❌ 타브 악보가 렌더링되지 않았습니다.')
    await page.screenshot({ path: 'test-results/failed-tab-rendering.png' })
  }
  
  // 최소한 하나의 프렛 숫자가 있어야 함
  expect(fretCount).toBeGreaterThan(0)
})
