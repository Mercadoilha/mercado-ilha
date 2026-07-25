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
  // Clone do último banner no início e do primeiro no fim: o trilho pode correr para os
  // dois lados sem "bater na parede". Ao cair num clone volta ao original sem animação
  // (o olho não percebe). Por isso o banner real nº 0 fica na posição 1 do trilho.
  const slides = loop ? [banners[total - 1], ...banners, banners[0]] : banners;
  const first = loop ? 1 : 0;
  const last = loop ? total : 0;

  const [idx, setIdx] = useState(first);
  const [animate, setAnimate] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [entered, setEntered] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Estado do arrasto com o dedo. Fica em ref (não em state) para mover o trilho
  // direto no DOM durante o gesto: sem re-render por quadro, o deslize fica suave.
  const drag = useRef({ on: false, x0: 0, y0: 0, dx: 0, axis: "" as "" | "h" | "v", moved: false });

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

  // Caiu num clone (uma ponta ou a outra) → salta para o original com a animação desligada.
  useEffect(() => {
    if (!loop) return;
    const jumpTo = idx === total + 1 ? first : idx === 0 ? last : null;
    if (jumpTo === null) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setIdx(jumpTo);
    }, SLIDE_MS + 20);
    return () => clearTimeout(t);
  }, [idx, total, loop, first, last]);

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

  // Qual banner REAL está à vista (o trilho tem os clones das pontas).
  const active = loop ? (idx - 1 + total) % total : 0;

  const goTo = (i: number) => {
    setAnimate(true);
    setIdx(loop ? i + 1 : i);
    setResetKey((k) => k + 1);
  };

  // ── Arrastar com o dedo (os dois sentidos) ────────────────────────────────
  // Enquanto o dedo está na tela o trilho acompanha em tempo real; ao soltar,
  // passa de banner se o arrasto foi decidido, senão volta ao lugar.
  const slideStep = 100 / slides.length; // largura de um slide em % do trilho

  const onPointerDown = (e: React.PointerEvent) => {
    if (!loop) return;
    if (timer.current) clearInterval(timer.current); // pausa o automático durante o gesto
    drag.current = { on: true, x0: e.clientX, y0: e.clientY, dx: 0, axis: "", moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      // Decide uma única vez se o gesto é horizontal (banner) ou vertical (rolar a página).
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (d.axis === "h") e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "h") return;
    d.dx = dx;
    d.moved = true;
    const el = trackRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translateX(calc(${-idx * slideStep}% + ${dx}px))`;
    }
  };

  const endDrag = () => {
    const d = drag.current;
    if (!d.on) return;
    const width = trackRef.current?.parentElement?.offsetWidth ?? 320;
    let next = idx;
    if (d.axis === "h") {
      const threshold = Math.max(40, width * 0.18); // arrasto curto demais → volta ao lugar
      if (d.dx <= -threshold) next = idx + 1;
      else if (d.dx >= threshold) next = idx - 1;
    }
    drag.current = { ...d, on: false, axis: "", dx: 0 };
    // Escreve já o destino no DOM (mesmos valores que o React vai renderizar): sem isto o
    // trilho ficaria preso no "transition: none" que o arrasto deixou.
    const el = trackRef.current;
    if (el) {
      el.style.transition = `transform ${SLIDE_MS}ms ease`;
      el.style.transform = `translateX(-${next * slideStep}%)`;
    }
    setAnimate(true);
    if (next !== idx) setIdx(next);
    setResetKey((k) => k + 1); // religa o automático a partir de agora
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: "relative",
        borderRadius: 0,
        overflow: "hidden",
        height: 130,
        background: "var(--blue-xlight)",
        opacity: entered ? 1 : 0,
        transition: "opacity 0.6s ease",
        // pan-y: o dedo para cima/baixo continua rolando a página; para os lados é o banner.
        touchAction: "pan-y",
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: "flex",
          height: "100%",
          width: `${slides.length * 100}%`,
          transform: `translateX(-${idx * slideStep}%)`,
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
                priority={i === first}
                draggable={false}
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
                  // Arrastar para trocar de banner não deve abrir o anunciante.
                  onClick={(e) => {
                    if (drag.current.moved) {
                      e.preventDefault();
                      drag.current.moved = false;
                      return;
                    }
                    trackBannerClick(b.id, position ?? null);
                  }}
                  draggable={false}
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
