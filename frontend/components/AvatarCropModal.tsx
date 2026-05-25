"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CROP_SIZE = 280;   // viewport square px
const CIRCLE_R = 120;    // crop circle radius px (diameter 240, 20px dark border per side)
const OUTPUT_SIZE = 600; // output canvas px
const MAX_ZOOM = 4;      // max zoom multiplier over minScale

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [nw, setNw] = useState(1);
  const [nh, setNh] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);

  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const pinchStart = useRef<{ dist: number; scale: number; ox: number; oy: number } | null>(null);

  // Clamp offset so image always covers the crop circle
  const clamp = useCallback(
    (ox: number, oy: number, s: number, imgW: number, imgH: number) => {
      const hw = Math.max(0, (imgW * s) / 2 - CIRCLE_R);
      const hh = Math.max(0, (imgH * s) / 2 - CIRCLE_R);
      return {
        x: Math.min(hw, Math.max(-hw, ox)),
        y: Math.min(hh, Math.max(-hh, oy)),
      };
    },
    [],
  );

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const ms = Math.max((CIRCLE_R * 2) / imgW, (CIRCLE_R * 2) / imgH);
    setNw(imgW);
    setNh(imgH);
    setMinScale(ms);
    setScale(ms);
    setOffset({ x: 0, y: 0 });
    setReady(true);
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
          scale, nw, nh,
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
  }, [scale, nw, nh, clamp]);

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
          scale, nw, nh,
        ),
      );
    } else if (e.touches.length >= 2 && pinchStart.current) {
      const ps = pinchStart.current;
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const newScale = Math.min(
        minScale * MAX_ZOOM,
        Math.max(minScale, ps.scale * (dist / ps.dist)),
      );
      const ratio = newScale / ps.scale;
      setScale(newScale);
      setOffset(clamp(ps.ox * ratio, ps.oy * ratio, newScale, nw, nh));
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
    setOffset((prev) => clamp(prev.x * ratio, prev.y * ratio, s, nw, nh));
  };

  // ── Confirm: extract crop to canvas ──
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !ready) return;
    // Source rect in natural image pixels
    const sw = (CIRCLE_R * 2) / scale;
    const sx = nw / 2 - (CIRCLE_R + offset.x) / scale;
    const sy = nh / 2 - (CIRCLE_R + offset.y) / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.85);
  };

  // ── Layout math ──
  const displayW = nw * scale;
  const displayH = nh * scale;
  const imgLeft = CROP_SIZE / 2 + offset.x - displayW / 2;
  const imgTop = CROP_SIZE / 2 + offset.y - displayH / 2;
  const circleInset = CROP_SIZE / 2 - CIRCLE_R; // 20px — gap between circle and viewport edge

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
      {/* Hidden img — used for naturalWidth/Height and canvas drawImage */}
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
          gap: "1rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1e293b", textAlign: "center" }}>
          Ajustar foto
        </h3>

        {/* ── Crop viewport ── */}
        <div
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            position: "relative",
            overflow: "hidden",
            borderRadius: 10,
            background: "#111",
            alignSelf: "center",
            cursor: grabbing ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            flexShrink: 0,
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Draggable image */}
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
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          )}

          {/* Dark overlay with circular hole via radial-gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(circle ${CIRCLE_R}px at ${CROP_SIZE / 2}px ${CROP_SIZE / 2}px, transparent ${CIRCLE_R - 0.5}px, rgba(0,0,0,0.58) ${CIRCLE_R}px)`,
            }}
          />

          {/* Circle border */}
          <div
            style={{
              position: "absolute",
              left: circleInset,
              top: circleInset,
              width: CIRCLE_R * 2,
              height: CIRCLE_R * 2,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.75)",
              pointerEvents: "none",
            }}
          />

          {/* Loading state */}
          {!ready && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" />
            </div>
          )}
        </div>

        {/* ── Zoom slider ── */}
        {ready && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1rem", color: "#94a3b8", lineHeight: 1, userSelect: "none" }}>−</span>
            <input
              type="range"
              min={minScale}
              max={minScale * MAX_ZOOM}
              step={minScale * 0.005}
              value={scale}
              onChange={onZoom}
              style={{ flex: 1, accentColor: "var(--blue-main)", cursor: "pointer" }}
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
