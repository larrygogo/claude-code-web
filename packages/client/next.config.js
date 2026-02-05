/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@claude-web/shared'],
};

module.exports = nextConfig;
