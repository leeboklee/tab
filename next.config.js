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
    return [
      {
        source: '/api/python/:path*',
        destination: 'http://localhost:8002/:path*',
      },
    ]
  },
}

module.exports = nextConfig
