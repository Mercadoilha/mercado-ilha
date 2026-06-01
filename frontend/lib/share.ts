export function compartilhar({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    const encoded = encodeURIComponent(text + " " + url);
    window.open("https://wa.me/?text=" + encoded, "_blank");
  }
}
