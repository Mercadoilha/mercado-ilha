"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { getAdminSettings, whatsappUrl } from "../lib/adminSettings";

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

export default function BannerRotativo({ position = "home" }: { position?: "home" | "listado" }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminWa, setAdminWa] = useState("5571999999999");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [intervalMs, setIntervalMs] = useState(4000);

  useEffect(() => {
    Promise.all([
      supabase.from("banners").select("id,title,image_url,link_url").eq("position", position).eq("active", true).order("sort_order"),
      getAdminSettings(),
    ]).then(([{ data }, settings]) => {
      setBanners(data ?? []);
      setAdminWa(settings.whatsapp);
      setIntervalMs(settings.bannerInterval);
      setLoading(false);
    });
  }, [position]);

  useEffect(() => {
    if (banners.length <= 1) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % banners.length);
    }, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [banners.length, intervalMs]);

  const goTo = (i: number) => {
    setIdx(i);
    if (timer.current) clearInterval(timer.current);
    if (banners.length > 1) {
      timer.current = setInterval(() => setIdx((prev) => (prev + 1) % banners.length), intervalMs);
    }
  };

  // ── No banners ──
  if (!loading && banners.length === 0) {
    return (
      <div style={{ margin: "0.875rem 1rem" }}>
        <div
          style={{
            background: "linear-gradient(135deg, var(--blue-xlight), var(--green-sea))",
            borderRadius: 12,
            height: 130,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            position: "relative",
          }}
        >
          <span style={{ position: "absolute", top: 8, right: 10, fontSize: "0.6rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.8)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.05em" }}>
            PUBLICIDADE
          </span>
          <span style={{ fontSize: "2.5rem" }}>🏝️</span>
          <span style={{ fontWeight: 700, color: "var(--blue-main)", fontSize: "0.95rem" }}>
            Seu negócio aqui!
          </span>
        </div>
        <p style={{ textAlign: "center", padding: "0.4rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Quer anunciar aqui?{" "}
          <a
            href={whatsappUrl(adminWa, "Quero anunciar no Mercado Ilha")}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}
          >
            Fale conosco
          </a>
        </p>
      </div>
    );
  }

  if (loading) return <div style={{ margin: "0.875rem 1rem", height: 130, borderRadius: 12, background: "var(--blue-xlight)", animation: "pulse 1.5s ease-in-out infinite" }} />;

  const current = banners[idx];

  const content = (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        height: 130,
        background: "var(--blue-xlight)",
      }}
    >
      {/* Etiqueta */}
      <span style={{ position: "absolute", top: 8, right: 10, fontSize: "0.6rem", color: "#fff", background: "rgba(0,0,0,0.45)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.05em", zIndex: 2 }}>
        PUBLICIDADE
      </span>

      {/* Imagen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.id}
        src={current.image_url}
        alt={current.title ?? "Banner"}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "opacity 0.4s" }}
      />

      {/* Dots de navegación */}
      {banners.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 5,
            zIndex: 2,
          }}
        >
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.preventDefault(); goTo(i); }}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.25s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ margin: "0.875rem 1rem" }}>
      {current.link_url ? (
        <a href={current.link_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block" }}>
          {content}
        </a>
      ) : (
        content
      )}
      <p style={{ textAlign: "center", padding: "0.4rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
        Quer anunciar aqui?{" "}
        <a
          href={whatsappUrl(adminWa, "Quero anunciar no Mercado Ilha")}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}
        >
          Fale conosco
        </a>
      </p>
    </div>
  );
}
