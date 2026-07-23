-- Fase 28: subcategorias de "busca" (não produto) dentro de uma categoria de produto.
-- Ex.: "Procuro comprar" em "Casas e terrenos" é uma busca, não um item à venda, então
-- NÃO deve mostrar o botão "Vendido" no perfil (que exclui o anúncio).
--
-- Controlado por subcategoria desde /admin → tab Categorias. Arranca em true (produto)
-- para todas: o comportamento atual não muda até o admin marcar uma subcategoria como
-- busca. O botão "Vendido" só aparece quando a categoria é produto (categories.is_product)
-- E a subcategoria também é produto (subcategories.is_product).

alter table public.subcategories
  add column if not exists is_product boolean not null default true;

comment on column public.subcategories.is_product is
  'true = subcategoria de produto vendável (herda o botão "Vendido" da categoria); false = busca (ex. "Procuro comprar"), nunca mostra o botão "Vendido"';
