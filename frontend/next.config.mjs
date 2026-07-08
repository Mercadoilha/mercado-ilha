const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Las fotos de anuncios tienen path inmutable (randomUUID()-Date.now() en
    // /api/upload), así que las variantes optimizadas se pueden cachear en el CDN
    // por semanas en vez de re-optimizarse cada 60 s (default). Abarata cargas
    // repetidas y cuida el free tier de Image Optimization de Vercel.
    // Excepción: los banners de /public/banners se reemplazan in-place → versionar
    // el nombre del archivo (banner-...-v2.png) para no servir la versión vieja.
    minimumCacheTTL: 2678400, // 31 días
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev" },
      { protocol: "https", hostname: "mercadoilha.vercel.app" },
    ],
  },
};

export default nextConfig;
