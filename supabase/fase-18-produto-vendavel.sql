-- Fase 18: distinguir categorias "produto" (vendável, some do site quando vendido)
-- de "serviço". Controlado por categoria desde /admin → tab Categorias.
-- Arranca em false para todas: nenhuma categoria mostra o botão "Vendido" até
-- o admin ativar manualmente as que correspondem (Produtos, Veículos, etc.).

alter table public.categories
  add column if not exists is_product boolean not null default false;

comment on column public.categories.is_product is
  'true = categoria de produto vendável (mostra botão "Vendido" no perfil, que exclui o anúncio); false = serviço';
