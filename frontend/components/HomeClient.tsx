"use client";

import { useMemo } from "react";
import BannerRotativo from "./BannerRotativo";
import SearchHeader from "./SearchHeader";
import InstallInvitePopup from "./InstallInvitePopup";
import ListingsFeed from "./ListingsFeed";
import MercadoBanner from "./MercadoBanner";

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

// Acesso ao Mercado Agroecológico (configurável em admin_settings). Se vier
// desligado ou sem configuração, o botão simplesmente não aparece.
type MercadoButton = {
  title: string;
  subtitle: string | null;
  badge: string | null;
};

type Props = {
  listings: any[];
  featuredIds: number[];
  adminWa: string;
  banners: Banner[];
  bannerInterval: number;
  mercadoButton: MercadoButton | null;
};

export default function HomeClient({ listings, featuredIds, adminWa, banners, bannerInterval, mercadoButton }: Props) {
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
        homeExtras
        beforeGrid={
          mercadoButton ? (
            <MercadoBanner
              title={mercadoButton.title}
              subtitle={mercadoButton.subtitle}
              badge={mercadoButton.badge}
            />
          ) : null
        }
      />

      <InstallInvitePopup />
    </div>
  );
}
