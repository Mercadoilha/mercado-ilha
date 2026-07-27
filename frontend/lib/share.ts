/**
 * Marca el link que sale de un "Compartilhar" (fase-31) para poder medir
 * cuánta gente llega por el boca a boca de los propios usuarios.
 *
 * Además LIMPIA el marcador que traía la pantalla: varias de estas
 * llamadas comparten `window.location.href`, así que quien entró por un
 * link de los grupos (`?de=grupo`) arrastraría ese origen a todos los
 * que comparta — y el panel diría "vino de los grupos" cuando en
 * realidad vino de un conocido.
 */
function marcarComoCompartilhado(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    u.searchParams.delete("de");
    u.searchParams.set("de", "compartilhado");
    return u.toString();
  } catch {
    return url;
  }
}

export function compartilhar({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  const link = marcarComoCompartilhado(url);

  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, text, url: link }).catch(() => {});
  } else {
    const encoded = encodeURIComponent(text + " " + link);
    window.open("https://wa.me/?text=" + encoded, "_blank");
  }
}
