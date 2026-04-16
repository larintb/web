/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ngawprdwxmjgxnrxvuwd.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    // Las imágenes de Supabase ya vienen optimizadas desde su CDN.
    // Evita que el servidor Next.js actúe como proxy/caché de imágenes.
    unoptimized: true,
  },
};

module.exports = nextConfig;
