"use client";

import BannerRotativo from "./BannerRotativo";
import SearchHeader from "./SearchHeader";
import CategoriesBlocks from "./CategoriesBlocks";

type Banner = { id: number; title: string | null; image_url: string; link_url: string | null };

type Props = {
  categories: any[];
  adminWa: string;
  banners: Banner[];
  bannerInterval: number;
};

export default function CategoriasClient({ categories, adminWa, banners, bannerInterval }: Props) {
  return (
    <div className="page-body">
      {/* ── Header azul (idéntico al inicio: logo + Compartilhar + busca) ── */}
      <SearchHeader />

      {/* ── Banner publicitário ── */}
      <BannerRotativo position="home" banners={banners} adminWa={adminWa} bannerInterval={bannerInterval} />

      {/* ── Categorias Destacadas + seções temáticas ── */}
      <CategoriesBlocks categories={categories} />
    </div>
  );
}
