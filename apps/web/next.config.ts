import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: process.env.NEXT_DIST_DIR === '.next-e2e' ? false : undefined,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  // Socket.IO serves its Engine.IO endpoint at `/socket.io/`. Do not redirect
  // it to the slashless path, which the Socket.IO server does not handle.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_ORIGIN ?? 'http://127.0.0.1:3001';
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/:path*` },
      { source: '/socket.io/', destination: `${apiOrigin}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${apiOrigin}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
