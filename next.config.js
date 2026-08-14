/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Stage 1: lint is available via `npm run lint` but must not fail `next build`.
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['img.youtube.com', 'i.ytimg.com'],
  },
  async rewrites() {
    const backend = (process.env.REAL_AUDIO_API_BASE || 'http://localhost:8002').replace(/\/$/, '')
    if (process.env.VERCEL && !process.env.REAL_AUDIO_API_BASE) {
      return []
    }
    return [
      {
        source: '/api/python/:path*',
        destination: `${backend}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
