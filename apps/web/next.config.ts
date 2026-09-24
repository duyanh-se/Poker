import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: process.env.NEXT_DIST_DIR === '.next-e2e' ? false : undefined,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_ORIGIN ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
