import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3019'

test('버튼 클릭 디버그', async ({ page }) => {
  test.setTimeout(60000)
  
  // 콘솔 로그 수집
  page.on('console', msg => {
    console.log(`브라우저 콘솔 [${msg.type()}]:`, msg.text())
  })
  
  // 페이지 로드
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  
  // URL 입력
  const ytUrl = 'https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi'
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  console.log('URL 입력 완료')
  
  // 빠른 분석 선택 (기본값)
  const quickAnalysisRadio = page.locator('input[name=analysis-type]').first()
  await quickAnalysisRadio.check()
  console.log('빠른 분석 선택 완료')
  
  // 분석 버튼 찾기
  const analyzeButton = page.getByRole('button', { name: /타브/ })
  const buttonText = await analyzeButton.textContent()
  console.log('분석 버튼 텍스트:', buttonText)
  
  // 버튼이 활성화되어 있는지 확인
  const isDisabled = await analyzeButton.isDisabled()
  console.log('버튼 비활성화 상태:', isDisabled)
  
  // 버튼 클릭 전 상태 확인
  console.log('=== 버튼 클릭 전 상태 ===')
  const beforeClickContent = await page.content()
  console.log('분석 중 텍스트:', beforeClickContent.includes('분석 중'))
  console.log('생성된 악보 텍스트:', beforeClickContent.includes('생성된 악보'))
  
  // 버튼 클릭
  console.log('🖱️ 분석 버튼 클릭 시도')
  await analyzeButton.click()
  console.log('✅ 분석 버튼 클릭 완료')
  
  // 클릭 후 즉시 상태 확인
  await page.waitForTimeout(1000)
  console.log('=== 버튼 클릭 후 1초 상태 ===')
  const afterClickContent = await page.content()
  console.log('분석 중 텍스트:', afterClickContent.includes('분석 중'))
  console.log('생성된 악보 텍스트:', afterClickContent.includes('생성된 악보'))
  
  // 5초 후 상태 확인
  await page.waitForTimeout(4000)
  console.log('=== 버튼 클릭 후 5초 상태 ===')
  const finalContent = await page.content()
  console.log('분석 중 텍스트:', finalContent.includes('분석 중'))
  console.log('생성된 악보 텍스트:', finalContent.includes('생성된 악보'))
  console.log('원본 영상 텍스트:', finalContent.includes('원본 영상'))
  console.log('타브 악보 텍스트:', finalContent.includes('타브 악보'))
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/button-click-debug.png', fullPage: true })
})

