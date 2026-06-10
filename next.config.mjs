/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse e mammoth vanno risolti da node_modules a runtime
  // (il worker di pdf.js non è bundlabile da Next)
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
