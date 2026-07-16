// Voltar seguro: usa router.back() quando a própria aba tem alguma entrada de histórico
// anterior (o caso normal — veio de outra tela dentro do app), preservando filtros/scroll
// da tela anterior. Se não há histórico (deep link, atalho do PWA, aba nova abrindo direto
// nesta rota), back() não faria nada ou sairia do site — nesse caso cai no destino padrão.
type MinimalRouter = { back: () => void; replace: (href: string) => void };

export function safeBack(router: MinimalRouter, fallbackHref: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
