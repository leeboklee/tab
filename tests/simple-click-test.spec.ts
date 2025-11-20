import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('간단한 클릭 테스트', async ({ page }) => {
  test.setTimeout(30000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  
  // 분석 버튼 클릭
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  await analyzeButton.click()
  
  // 알림 대기 (만약 나타난다면)
  try {
    await page.waitForEvent('dialog', { timeout: 2000 })
    console.log('✅ 알림이 나타났습니다!')
  } catch (error) {
    console.log('❌ 알림이 나타나지 않았습니다.')
  }
  
  // 3초 대기
  await page.waitForTimeout(3000)
  
  // 결과 확인
  const pageContent = await page.content()
  console.log('생성된 악보 텍스트:', pageContent.includes('생성된 악보'))
  console.log('테스트 곡 텍스트:', pageContent.includes('테스트 곡'))
  console.log('원본 영상 텍스트:', pageContent.includes('원본 영상'))
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/simple-click-test.png', fullPage: true })
})

