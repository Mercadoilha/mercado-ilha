const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev" },
    ],
  },
};

export default nextConfig;
