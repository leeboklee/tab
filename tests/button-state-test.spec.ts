import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('버튼 상태 확인 테스트', async ({ page }) => {
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
  
  // 분석 버튼 찾기
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  
  // 버튼 상태 확인
  const isDisabled = await analyzeButton.isDisabled()
  const isVisible = await analyzeButton.isVisible()
  const buttonText = await analyzeButton.textContent()
  
  console.log('버튼 상태:')
  console.log('- 비활성화됨:', isDisabled)
  console.log('- 보임:', isVisible)
  console.log('- 텍스트:', buttonText)
  
  // 버튼의 HTML 속성 확인
  const buttonHTML = await analyzeButton.innerHTML()
  console.log('버튼 HTML:', buttonHTML)
  
  // 버튼 클릭 시도
  try {
    await analyzeButton.click()
    console.log('버튼 클릭 성공')
  } catch (error) {
    console.log('버튼 클릭 실패:', error)
  }
  
  // 3초 대기
  await page.waitForTimeout(3000)
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/button-state-test.png', fullPage: true })
})

