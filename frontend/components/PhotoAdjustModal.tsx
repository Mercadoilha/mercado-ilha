"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FRAME = 280;        // viewport square px — mismo encuadre 1:1 que la card de la vitrine
const OUTPUT_SIZE = 1200; // lado del canvas de salida del recorte
const MAX_ZOOM = 3;       // zoom máximo sobre la escala "cover"

export type PhotoAdjustResult = { blob: Blob; dataUrl: string };

interface Props {
  imageSrc: string;
  /** null = el usuario confirmó sin tocar nada: conservar el archivo original */
  onConfirm: (result: PhotoAdjustResult | null) => void;
  onCancel: () => void;
}

export default function PhotoAdjustModal({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [nw, setNw] = useState(1);
  const [nh, setNh] = useState(1);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [minScale, setMinScale] = useState(1); // "contain": la foto entra completa (como hoy)
  const [coverScale, setCoverScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);

  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const pinchStart = useRef<{ dist: number; scale: number; ox: number; oy: number } | null>(null);

  // Dimensiones efectivas (naturales) según rotación
  const enw = rotation % 180 === 0 ? nw : nh;
  const enh = rotation % 180 === 0 ? nh : nw;

  // Clamp: si la imagen es más chica que el marco en un eje queda centrada;
  // si es más grande, no puede dejar hueco de más al arrastrar.
  const clamp = useCallback((ox: number, oy: number, s: number, ew: number, eh: number) => {
    const hw = Math.max(0, (ew * s) / 2 - FRAME / 2);
    const hh = Math.max(0, (eh * s) / 2 - FRAME / 2);
    return { x: Math.min(hw, Math.max(-hw, ox)), y: Math.min(hh, Math.max(-hh, oy)) };
  }, []);

  const fitScales = (ew: number, eh: number) => ({
    fit: Math.min(FRAME / ew, FRAME / eh),
    cover: Math.max(FRAME / ew, FRAME / eh),
  });

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const { fit, cover } = fitScales(img.naturalWidth, img.naturalHeight);
    setNw(img.naturalWidth);
    setNh(img.naturalHeight);
    setMinScale(fit);
    setCoverScale(cover);
    setScale(fit);
    setOffset({ x: 0, y: 0 });
    setReady(true);
  };

  const rotate = () => {
    const next = (rotation + 90) % 360;
    const ew = next % 180 === 0 ? nw : nh;
    const eh = next % 180 === 0 ? nh : nw;
    const { fit, cover } = fitScales(ew, eh);
    setRotation(next);
    setMinScale(fit);
    setCoverScale(cover);
    setScale(fit);
    setOffset({ x: 0, y: 0 });
  };

  // ── Mouse drag ──
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setGrabbing(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset(
        clamp(
          dragStart.current.ox + e.clientX - dragStart.current.mx,
          dragStart.current.oy + e.clientY - dragStart.current.my,
          scale, enw, enh,
        ),
      );
    };
    const onUp = () => { dragging.current = false; setGrabbing(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scale, enw, enh, clamp]);

  // ── Touch drag + pinch zoom ──
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      dragging.current = true;
      pinchStart.current = null;
      dragStart.current = {
        mx: e.touches[0].clientX, my: e.touches[0].clientY,
        ox: offset.x, oy: offset.y,
      };
    } else if (e.touches.length >= 2) {
      dragging.current = false;
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      pinchStart.current = { dist, scale, ox: offset.x, oy: offset.y };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging.current) {
      setOffset(
        clamp(
          dragStart.current.ox + e.touches[0].clientX - dragStart.current.mx,
          dragStart.current.oy + e.touches[0].clientY - dragStart.current.my,
          scale, enw, enh,
        ),
      );
    } else if (e.touches.length >= 2 && pinchStart.current) {
      const ps = pinchStart.current;
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const newScale = Math.min(
        coverScale * MAX_ZOOM,
        Math.max(minScale, ps.scale * (dist / ps.dist)),
      );
      const ratio = newScale / ps.scale;
      setScale(newScale);
      setOffset(clamp(ps.ox * ratio, ps.oy * ratio, newScale, enw, enh));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStart.current = null;
    if (e.touches.length === 0) dragging.current = false;
  };

  // ── Zoom slider ──
  const onZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = Number(e.target.value);
    const ratio = s / scale;
    setScale(s);
    setOffset((prev) => clamp(prev.x * ratio, prev.y * ratio, s, enw, enh));
  };

  const zoomedOrMoved = scale > minScale * 1.001 || Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5;
  const touched = rotation !== 0 || zoomedOrMoved;

  // ── Confirm ──
  const handleConfirm = () => {
    if (!touched) { onConfirm(null); return; } // sin cambios: conservar el original
    const img = imgRef.current;
    if (!img || !ready) return;

    // Fuente ya rotada (bitmap intermedio) para que el recorte use la misma
    // matemática simple del marco sin rotación.
    let source: HTMLImageElement | HTMLCanvasElement = img;
    if (rotation !== 0) {
      const rc = document.createElement("canvas");
      rc.width = enw;
      rc.height = enh;
      const rctx = rc.getContext("2d");
      if (!rctx) return;
      rctx.translate(enw / 2, enh / 2);
      rctx.rotate((rotation * Math.PI) / 180);
      rctx.drawImage(img, -nw / 2, -nh / 2);
      source = rc;
    }

    const canvas = document.createElement("canvas");

    if (!zoomedOrMoved) {
      // Solo rotación: exportar la foto completa rotada, sin barras.
      const k = Math.min(1, OUTPUT_SIZE / Math.max(enw, enh));
      canvas.width = Math.round(enw * k);
      canvas.height = Math.round(enh * k);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    } else {
      // Recorte cuadrado: lo que se ve en el marco es lo que queda.
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const sw = FRAME / scale;
      const sx = enw / 2 - (FRAME / 2 + offset.x) / scale;
      const sy = enh / 2 - (FRAME / 2 + offset.y) / scale;
      // Intersección con los límites de la foto: lo no cubierto queda blanco
      const ix = Math.max(0, sx);
      const iy = Math.max(0, sy);
      const ex = Math.min(enw, sx + sw);
      const ey = Math.min(enh, sy + sw);
      if (ex > ix && ey > iy) {
        const out = OUTPUT_SIZE / sw;
        ctx.drawImage(source, ix, iy, ex - ix, ey - iy, (ix - sx) * out, (iy - sy) * out, (ex - ix) * out, (ey - iy) * out);
      }
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    canvas.toBlob((blob) => { if (blob) onConfirm({ blob, dataUrl }); }, "image/jpeg", 0.85);
  };

  // ── Layout ──
  const displayW = nw * scale;
  const displayH = nh * scale;
  const imgLeft = FRAME / 2 + offset.x - displayW / 2;
  const imgTop = FRAME / 2 + offset.y - displayH / 2;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Hidden img — fuente para medidas y para el canvas */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={imageSrc} alt="" onLoad={onImgLoad} style={{ display: "none" }} />

      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "1.25rem",
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1e293b", textAlign: "center" }}>
          Ajustar foto
        </h3>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", textAlign: "center" }}>
          O quadrado é o que aparece na vitrine. Arraste, dê zoom ou gire.
        </p>

        {/* ── Marco cuadrado (mismo encuadre que la card) ── */}
        <div
          style={{
            width: FRAME,
            height: FRAME,
            position: "relative",
            overflow: "hidden",
            borderRadius: 4,
            border: "2px solid var(--blue-main)",
            background: "#fff",
            alignSelf: "center",
            cursor: grabbing ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            flexShrink: 0,
            boxSizing: "content-box",
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {ready && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: imgLeft,
                top: imgTop,
                width: displayW,
                height: displayH,
                transform: `rotate(${rotation}deg)`,
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          )}

          {!ready && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" />
            </div>
          )}
        </div>

        {/* ── Girar + zoom ── */}
        {ready && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={rotate}
              style={{
                border: "1.5px solid var(--blue-main)",
                background: "transparent",
                color: "var(--blue-main)",
                borderRadius: 10,
                padding: "0.4rem 0.6rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ↻ Girar
            </button>
            <span style={{ fontSize: "1rem", color: "#94a3b8", lineHeight: 1, userSelect: "none" }}>−</span>
            <input
              type="range"
              min={minScale}
              max={coverScale * MAX_ZOOM}
              step={minScale * 0.005}
              value={scale}
              onChange={onZoom}
              style={{ flex: 1, minWidth: 0, accentColor: "var(--blue-main)", cursor: "pointer" }}
            />
            <span style={{ fontSize: "1rem", color: "#94a3b8", lineHeight: 1, userSelect: "none" }}>+</span>
          </div>
        )}

        {/* ── Buttons ── */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 10,
              border: "1.5px solid var(--blue-main)",
              background: "transparent",
              color: "var(--blue-main)",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 10,
              border: "none",
              background: "#EF9F27",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: ready ? "pointer" : "not-allowed",
              opacity: ready ? 1 : 0.65,
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
