"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // updateViaCache: "none" fuerza al navegador a revalidar /sw.js en cada carga (sin
      // servirlo desde el HTTP cache), para que un bump de CACHE_VERSION se propague rápido.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {/* silently fail in dev */});
    }
  }, []);
  return null;
}
