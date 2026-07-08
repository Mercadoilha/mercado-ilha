"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    // Nunca en dev: los chunks de /_next/static no tienen hash estable entre
    // builds, y el SW los cachea cache-first → serviría JS viejo sin darse cuenta.
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      // updateViaCache: "none" fuerza al navegador a revalidar /sw.js en cada carga (sin
      // servirlo desde el HTTP cache), para que un bump de CACHE_VERSION se propague rápido.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {/* silently fail */});
    }
  }, []);
  return null;
}
