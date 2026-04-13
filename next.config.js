/** @type {import('next').NextConfig} */
const nextConfig = {
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
