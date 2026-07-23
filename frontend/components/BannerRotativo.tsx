"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { whatsappUrl } from "../lib/adminSettings";
import { trackBannerClick, trackWhatsappClick } from "../lib/tracking";

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

type Props = {
  position?: "home" | "listado" | "categorias";
  banners: Banner[];
  adminWa: string;
  bannerInterval: number;
};

const SLIDE_MS = 500;

export default function BannerRotativo({ position, banners, adminWa, bannerInterval }: Props) {
  const total = banners.length;
  const loop = total > 1;
  // Clone do primeiro banner no fim do trilho: assim o carrossel sempre corre para a
  // esquerda. Ao chegar no clone volta ao início sem animação (o olho não percebe).
  const slides = loop ? [...banners, banners[0]] : banners;

  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [entered, setEntered] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fade-in de entrada: ao abrir a tela (Início ou Categorias) o carrossel sempre começa
  // no primeiro banner. Sem isto ele aparecia de forma seca. Só um fade de CSS no
  // primeiro quadro — não atrasa nada nem adia o carregamento da imagem.
  // Dois requestAnimationFrame: o navegador precisa pintar o opacity 0 antes de mudar
  // para 1, senão junta as duas mudanças num frame só e não há transição nenhuma.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!loop) return;
    timer.current = setInterval(() => {
      setAnimate(true);
      setIdx((i) => i + 1);
    }, bannerInterval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loop, bannerInterval, resetKey]);

  // Chegou no clone → salta de volta ao primeiro com a animação desligada.
  useEffect(() => {
    if (!loop || idx !== total) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setIdx(0);
      setResetKey((k) => k + 1);
    }, SLIDE_MS + 20);
    return () => clearTimeout(t);
  }, [idx, total, loop]);

  // Religa a animação só depois que o salto já foi pintado.
  useEffect(() => {
    if (animate) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [animate]);

  const active = idx % total || 0;

  const goTo = (i: number) => {
    setAnimate(true);
    setIdx(i);
    setResetKey((k) => k + 1);
  };

  // ── No banners ──
  if (banners.length === 0) {
    return (
      <div style={{ margin: 0 }}>
        <div
          style={{
            background: "linear-gradient(135deg, var(--blue-xlight), var(--green-sea))",
            borderRadius: 0,
            height: 130,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            position: "relative",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>🏝️</span>
          <span style={{ fontWeight: 700, color: "var(--blue-main)", fontSize: "0.95rem" }}>
            Seu negócio aqui!
          </span>
        </div>
        <p style={{ textAlign: "center", padding: "0.4rem 1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Quer anunciar aqui?{" "}
          <a
            href={whatsappUrl(adminWa, "Quero anunciar no Mercado Ilha")}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhatsappClick(null, "banner_cta")}
            style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none", cursor: "pointer", font: "inherit" }}
          >
            Fale conosco
          </a>
        </p>
      </div>
    );
  }

  // ── Carrossel: todos os slides num trilho horizontal que desliza (translateX).
  // Cada slide é seu próprio link, então a imagem que aparece sempre leva ao anunciante
  // correto — inclusive durante a transição, quando dois slides ficam visíveis. Só o
  // primeiro carrega com priority; os demais sob demanda (não pesam no carregamento inicial).
  const content = (
    <div
      style={{
        position: "relative",
        borderRadius: 0,
        overflow: "hidden",
        height: 130,
        background: "var(--blue-xlight)",
        opacity: entered ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          width: `${slides.length * 100}%`,
          transform: `translateX(-${idx * (100 / slides.length)}%)`,
          transition: animate ? `transform ${SLIDE_MS}ms ease` : "none",
        }}
      >
        {slides.map((b, i) => {
          const slide = (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={b.image_url}
                alt={b.title ?? "Banner"}
                fill
                sizes="100vw"
                priority={i === 0}
                style={{ objectFit: "cover", display: "block" }}
              />
            </div>
          );
          return (
            <div
              key={`${b.id}-${i}`}
              style={{ width: `${100 / slides.length}%`, height: "100%", flexShrink: 0 }}
            >
              {b.link_url ? (
                <a
                  href={b.link_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackBannerClick(b.id, position ?? null)}
                  style={{ textDecoration: "none", display: "block", width: "100%", height: "100%" }}
                >
                  {slide}
                </a>
              ) : (
                slide
              )}
            </div>
          );
        })}
      </div>

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
                width: i === active ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? "#fff" : "rgba(255,255,255,0.5)",
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
    <div style={{ margin: 0 }}>
      {content}
      <p style={{ textAlign: "center", padding: "0.4rem 1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
        Quer anunciar aqui?{" "}
        <a
          href={whatsappUrl(adminWa, "Quero anunciar no Mercado Ilha")}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackWhatsappClick(null, "banner_cta")}
          style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}
        >
          Fale conosco
        </a>
      </p>
    </div>
  );
}
