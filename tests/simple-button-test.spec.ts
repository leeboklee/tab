import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('간단한 버튼 클릭 테스트', async ({ page }) => {
  test.setTimeout(30000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 알림 대기
  page.on('dialog', dialog => {
    console.log('✅ 알림이 나타났습니다:', dialog.message())
    dialog.accept()
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  console.log('페이지 로드 완료')
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  console.log('URL 입력 완료')
  
  // 분석 버튼 찾기
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  const buttonText = await analyzeButton.textContent()
  console.log('버튼 텍스트:', buttonText)
  
  // 버튼 클릭
  await analyzeButton.click()
  console.log('버튼 클릭 완료')
  
  // 3초 대기
  await page.waitForTimeout(3000)
  
  // 결과 확인
  const pageContent = await page.content()
  console.log('생성된 악보 포함:', pageContent.includes('생성된 악보'))
  console.log('원본 영상 포함:', pageContent.includes('원본 영상'))
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/simple-button-test.png', fullPage: true })
})

