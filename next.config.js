/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
