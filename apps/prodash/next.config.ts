import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@tomachina/ui',
    '@tomachina/core',
    '@tomachina/auth',
    '@tomachina/db',
  ],
}

export default nextConfig
