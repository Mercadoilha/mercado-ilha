// Traspaso card → detalle (T9 del plano de otimização). La card guarda los datos
// mínimos que ya tiene al hacer click; el detalle los pinta al instante (título,
// precio, primera foto, localidad) mientras llega la query completa. Mismo origen
// de navegación garantizado → un Map de módulo alcanza (se pierde en deep link /
// refresh, donde el detalle cae al skeleton, que es lo correcto).

export type ListingPreview = {
  id: number;
  title: string;
  price: number | null;
  price_text: string | null;
  condition: string | null;
  firstPhoto: string | null;
  localityName: string | null;
};

const previews = new Map<number, ListingPreview>();
const MAX = 30;

export function setListingPreview(p: ListingPreview): void {
  previews.delete(p.id);
  previews.set(p.id, p);
  while (previews.size > MAX) {
    const oldest = previews.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    previews.delete(oldest);
  }
}

export function getListingPreview(id: number): ListingPreview | null {
  return previews.get(id) ?? null;
}

// Invalidar após uma edição bem-sucedida: se o preview otimista ficasse com o título/preço
// antigos, ao voltar para o detalhe apareceriam por um instante antes da query completa
// sobrescrever (flash de dado velho). Sem preview, o detalhe cai no spinner normal até
// chegar o dado fresco — melhor do que mostrar algo errado.
export function clearListingPreview(id: number): void {
  previews.delete(id);
}
