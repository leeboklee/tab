import { test, expect } from '@playwright/test'

const APP_URL = 'http://localhost:3009'

test('디버그 테스트 - 분석 과정 확인', async ({ page }) => {
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
  
  // 선택 확인
  const isChecked = await realAnalysisRadio.isChecked()
  console.log('✅ 실제 오디오 분석 라디오 버튼 선택됨:', isChecked)
  
  // useRealAnalysis 상태 확인을 위해 페이지 새로고침
  await page.reload()
  await page.getByLabel('유튜브 URL 입력').fill(ytUrl)
  await realAnalysisRadio.check()
  
  // 분석 시작
  await page.getByRole('button', { name: /타브/ }).click()
  
  console.log('✅ 분석 버튼 클릭됨')
  
  // 30초 대기 (실제 오디오 분석 시간)
  await page.waitForTimeout(30000)
  
  // 페이지 내용 확인
  const pageContent = await page.content()
  console.log('페이지에 "실제 오디오 분석 결과" 텍스트가 있는가?', pageContent.includes('실제 오디오 분석 결과'))
  console.log('페이지에 "생성된 악보" 텍스트가 있는가?', pageContent.includes('생성된 악보'))
  console.log('페이지에 "타브 악보" 텍스트가 있는가?', pageContent.includes('타브 악보'))
  
  // 오류 메시지 확인
  const errorMessages = await page.locator('text=/오류|실패|error/i').count()
  console.log(`발견된 오류 메시지 개수: ${errorMessages}`)
  
  if (errorMessages > 0) {
    const errorTexts = await page.locator('text=/오류|실패|error/i').allTextContents()
    console.log('오류 메시지들:', errorTexts)
  }
  
  // 스크린샷 저장
  await page.screenshot({ path: 'test-results/debug-screenshot.png' })
  
  // 최소한 분석이 시작되었는지 확인
  const analysisStarted = pageContent.includes('실제 오디오 분석을 시작합니다') || 
                         pageContent.includes('실제 오디오 분석 결과') ||
                         pageContent.includes('생성된 악보')
  
  expect(analysisStarted).toBeTruthy()
})
