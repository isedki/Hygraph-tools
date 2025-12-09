import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow embedding in Hygraph iframe
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.hygraph.com https://app.hygraph.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;


