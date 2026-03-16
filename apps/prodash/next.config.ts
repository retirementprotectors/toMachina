import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@tomachina/ui',
    '@tomachina/core',
    '@tomachina/auth',
    '@tomachina/db',
  ],
  async rewrites() {
    // In dev, proxy API requests via rewrites (more reliable than catch-all route)
    // In production, the catch-all route.ts handles service-to-service identity tokens
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/api/:path*',
        },
      ]
    }
    return []
  },
}

export default nextConfig
