import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Guitar2Tabs - AI 기반 유튜브 음악 분석 서비스',
  description: '유튜브 URL을 입력하면 AI가 자동으로 기타 타브 악보를 생성해주는 서비스입니다.',
  keywords: ['기타', '타브', '악보', 'AI', '유튜브', '음악', '분석'],
  authors: [{ name: 'Guitar2Tabs Team' }],
  openGraph: {
    title: 'Guitar2Tabs - AI 기반 유튜브 음악 분석 서비스',
    description: '유튜브 URL을 입력하면 AI가 자동으로 기타 타브 악보를 생성해주는 서비스입니다.',
    type: 'website',
    locale: 'ko_KR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}

