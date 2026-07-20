"use client";

import { useEffect } from "react";
import BannerRotativo from "./BannerRotativo";
import SearchHeader from "./SearchHeader";
import CategoriesBlocks from "./CategoriesBlocks";
import { getCategoriesSync, loadCategories } from "../lib/catalogCache";

type Banner = { id: number; title: string | null; image_url: string; link_url: string | null };

type Props = {
  categories: any[];
  adminWa: string;
  banners: Banner[];
  bannerInterval: number;
};

export default function CategoriasClient({ categories, adminWa, banners, bannerInterval }: Props) {
  // Prewarm del catálogo de categorías (slug → id) en tiempo ocioso: esta pantalla es el
  // paso previo a tocar una categoría. Al abrir una categoría SIN subcategorías se navega a
  // /listings?category=, y ListingsFeed necesita este catálogo para resolver el slug antes
  // de pedir los anuncios. Dejándolo listo acá, esa primera categoría abre con UN solo viaje
  // de red (la query de anuncios) en vez de dos. No bloquea el render (requestIdleCallback) y
  // se apoya en el mismo caché de sesión (TTL 5 min) que ya usa el resto.
  useEffect(() => {
    if (getCategoriesSync()) return;
    const idle =
      typeof (window as any).requestIdleCallback === "function"
        ? (cb: () => void) => (window as any).requestIdleCallback(cb, { timeout: 2000 })
        : (cb: () => void) => setTimeout(cb, 200);
    idle(() => { loadCategories(); });
  }, []);

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
