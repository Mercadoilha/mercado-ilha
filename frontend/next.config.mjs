const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Layout máx 480px CSS (mobile-first, ver CLAUDE.md) con DPR real hasta 3x →
    // 1440px es el ancho útil más grande que cualquier imagen a ancho completo
    // puede necesitar. Recortar el espacio de variantes reduce cupo de
    // Image Transformations consumido y el peso del HTML de listas (menos
    // entradas en el srcset generado).
    deviceSizes: [480, 640, 828, 1080, 1440],
    imageSizes: [64, 96, 128, 256, 384],
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
  // Cabeceras de seguridad HTTP (auditoría 2026-07-11, H5). Sin CSP estricto: la app
  // usa estilos inline y un script inline en layout.tsx → un CSP mal calibrado rompería
  // la página. X-Frame-Options ya cubre clickjacking. CSP con pruebas = mejora futura.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
