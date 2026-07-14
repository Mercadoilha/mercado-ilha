"use client";

import { useMemo } from "react";
import BannerRotativo from "./BannerRotativo";
import SearchHeader from "./SearchHeader";
import InstallInvitePopup from "./InstallInvitePopup";
import ListingsFeed from "./ListingsFeed";

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

type Props = {
  listings: any[];
  featuredIds: number[];
  adminWa: string;
  banners: Banner[];
  bannerInterval: number;
};

export default function HomeClient({ listings, featuredIds, adminWa, banners, bannerInterval }: Props) {
  const featuredSet = useMemo(() => new Set(featuredIds), [featuredIds]);

  return (
    <div className="page-body">
      {/* ── Header azul (logo + Compartilhar + busca) ── */}
      <SearchHeader />

      {/* ── Banner publicitário ── */}
      <BannerRotativo position="home" banners={banners} adminWa={adminWa} bannerInterval={bannerInterval} />

      {/* ── Feed de todos os anúncios (Ordenar/Filtrar + grid + "Ver mais") ── */}
      <ListingsFeed
        initialData={listings}
        defaultOrder="bump"
        namespace="home:"
        featuredIds={featuredSet}
      />

      <InstallInvitePopup />
    </div>
  );
}
