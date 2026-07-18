// Hosts externos legítimos que la app usa en runtime (Supabase, R2, Vercel Speed
// Insights). La CSP de abajo se arma con estas constantes para no repetirlas.
const SUPABASE_HOST = "https://ywminblmiwjsxbntszbc.supabase.co";
const SUPABASE_WSS = "wss://ywminblmiwjsxbntszbc.supabase.co";
const R2_HOST = "https://pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev";
const VERCEL_VITALS = "https://vitals.vercel-insights.com";

// Content-Security-Policy (defensa en profundidad, auditoría 2026-07-18 / CN-002).
// La app usa estilos inline y dos scripts inline en layout.tsx → se mantiene
// 'unsafe-inline' en script/style (una CSP con nonce forzaría render dinámico y
// rompería el ISR: contra el pilar de velocidad). Aun así esta CSP aporta: bloquea
// cargar scripts/recursos desde orígenes externos, corta plugins (object-src 'none'),
// fija base-uri y refuerza el anti-clickjacking (frame-ancestors). 'wasm-unsafe-eval'
// habilita el WASM de heic2any (conversión HEIC al publicar); blob: cubre su worker
// y las previews de fotos.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${SUPABASE_HOST} ${R2_HOST} https://mercadoilha.vercel.app`,
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_WSS} ${R2_HOST} ${VERCEL_VITALS}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

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
      // Host exacto del proyecto Supabase (antes era el comodín *.supabase.co, que
      // permitía cargar imágenes de cualquier proyecto Supabase — CN-004).
      { protocol: "https", hostname: "ywminblmiwjsxbntszbc.supabase.co" },
      { protocol: "https", hostname: "pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev" },
      { protocol: "https", hostname: "mercadoilha.vercel.app" },
    ],
  },
  // Cabeceras de seguridad HTTP (auditoría 2026-07-11 H5; CSP agregada 2026-07-18 CN-002).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
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
