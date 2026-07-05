/**
 * SplashScreen — cortina de arranque para el PWA.
 *
 * Se renderiza en el primer HTML (Server Component) con animación CSS pura y
 * el logo real de la app (/logo.svg, precacheado por el service worker), para
 * que pinte ANTES de que cargue el bundle de JS y "decore" el delay de
 * apertura del app instalado.
 *
 * Solo se muestra en modo standalone (PWA instalado). En el navegador el
 * script inline lo quita al instante para no molestar en cada carga.
 */
export default function SplashScreen() {
  const css = `
    #mi-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
      background: #185FA5;
      opacity: 1;
      transition: opacity .45s ease;
    }
    #mi-splash.mi-show { display: flex; }
    #mi-splash.mi-hide { opacity: 0; pointer-events: none; }
    #mi-splash .mi-logo {
      height: 60px;
      width: auto;
      max-width: 78vw;
      transform: scale(.55);
      opacity: 0;
      animation: mi-pop .9s cubic-bezier(.16,1.2,.3,1) forwards;
      filter: drop-shadow(0 10px 24px rgba(0,0,0,.28));
    }
    #mi-splash .mi-sponsor {
      position: absolute;
      bottom: 46px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 9px;
      opacity: 0;
      animation: mi-rise .5s ease forwards .75s;
    }
    #mi-splash .mi-sponsor-label {
      color: rgba(255,255,255,.7);
      font-size: .66rem;
      letter-spacing: 1.6px;
      text-transform: uppercase;
    }
    #mi-splash .mi-sponsor-logo {
      max-height: 36px;
      max-width: 170px;
      object-fit: contain;
    }
    #mi-splash .mi-sponsor-name {
      color: #fff;
      font-weight: 700;
      font-size: .98rem;
    }
    @keyframes mi-pop {
      0%   { transform: scale(.55); opacity: 0; }
      60%  { transform: scale(1.04); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes mi-rise {
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      #mi-splash .mi-logo { animation: none; transform: scale(1); opacity: 1; }
      #mi-splash .mi-sponsor { animation: none; opacity: 1; transform: none; }
    }
  `;

  // Muestra el splash solo en PWA standalone; lo oculta cuando la app carga
  // (o pasado un mínimo para que la animación se vea), y siempre por un
  // failsafe de 3.5s por si algo se cuelga.
  const script = `
    (function () {
      var el = document.getElementById('mi-splash');
      if (!el) return;
      var standalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
      if (!standalone) { el.parentNode && el.parentNode.removeChild(el); return; }

      // Slot de patrocinador: se pinta al instante desde caché (localStorage),
      // sin esperar red. La imagen viaja como data-URL, así no hay request.
      try {
        var raw = localStorage.getItem('mi_splash_sponsor');
        if (raw) {
          var s = JSON.parse(raw);
          var slot = document.getElementById('mi-sponsor');
          if (slot && (s.img || s.name)) {
            var html = '<div class="mi-sponsor-label">oferecido por</div>';
            if (s.img) {
              var alt = (s.name || 'Patrocinador').replace(/"/g, '&quot;');
              html += '<img class="mi-sponsor-logo" src="' + s.img + '" alt="' + alt + '" />';
            } else {
              html += '<div class="mi-sponsor-name">' + String(s.name).replace(/</g, '&lt;') + '</div>';
            }
            slot.innerHTML = html;
          }
        }
      } catch (e) {}

      el.classList.add('mi-show');
      var start = Date.now();
      var done = false;
      function hide() {
        if (done) return; done = true;
        var wait = Math.max(0, 1100 - (Date.now() - start));
        setTimeout(function () {
          el.classList.add('mi-hide');
          setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 500);
        }, wait);
      }
      if (document.readyState === 'complete') hide();
      else window.addEventListener('load', hide);
      setTimeout(hide, 3500);
    })();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="mi-splash" aria-hidden="true">
        {/* Logo real da app (mesmo do header). Branco sobre azul. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mi-logo" src="/logo.svg" alt="Mercado Ilha" />
        {/* Slot de patrocinador — rellenado por el script inline desde caché */}
        <div id="mi-sponsor" className="mi-sponsor" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
