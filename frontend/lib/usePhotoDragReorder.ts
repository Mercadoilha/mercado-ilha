import { useCallback, useRef, useState } from "react";

/** Mueve un elemento de `from` a `to` devolviendo un array nuevo. */
export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const a = arr.slice();
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

/**
 * Arrastre táctil (o con mouse) para reordenar las miniaturas de fotos.
 * Sin dependencias: usa Pointer Events. Solo vive en las pantallas de
 * publicar/editar, así que no impacta la velocidad de navegación.
 *
 * Uso: en cada miniatura poner `data-photo-tile` + `data-photo-index={i}`,
 * spread de `handlers(i)` sobre la imagen y `touchAction: "none"` en su estilo.
 * El contenedor de la fila lleva `data-photo-row`.
 */
export function usePhotoDragReorder(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const state = useRef<{
    index: number;
    startX: number;
    startY: number;
    moved: boolean;
    over: number;
    row: HTMLElement | null;
    el: HTMLElement;
    pointerId: number;
  } | null>(null);
  // Evita que el "tap" para ajustar la foto se dispare justo después de arrastrar.
  const draggedRecently = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    state.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      over: index,
      row: el.closest("[data-photo-row]") as HTMLElement | null,
      el,
      pointerId: e.pointerId,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < 8) return; // umbral: distingue toque de arrastre
      s.moved = true;
      setDragIndex(s.index);
    }
    setOffset({ x: dx, y: dy });
    if (s.row) {
      const tiles = s.row.querySelectorAll<HTMLElement>("[data-photo-tile]");
      tiles.forEach((t) => {
        const idx = Number(t.dataset.photoIndex);
        if (idx === s.index) return; // la miniatura arrastrada se movió con el dedo
        const r = t.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          s.over = idx;
        }
      });
      setOverIndex(s.over);
    }
  }, []);

  const finish = useCallback(() => {
    const s = state.current;
    state.current = null;
    if (s?.moved) {
      draggedRecently.current = true;
      setTimeout(() => { draggedRecently.current = false; }, 0);
      if (s.over !== s.index) onReorder(s.index, s.over);
    }
    setDragIndex(null);
    setOverIndex(null);
    setOffset({ x: 0, y: 0 });
  }, [onReorder]);

  const handlers = useCallback((index: number) => ({
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, index),
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  }), [onPointerDown, onPointerMove, finish]);

  return {
    dragIndex,
    overIndex,
    offset,
    handlers,
    /** true si el gesto que acaba de terminar fue un arrastre (para anular el tap). */
    wasDrag: () => draggedRecently.current,
  };
}
