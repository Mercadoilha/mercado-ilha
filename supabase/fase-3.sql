-- FASE 3 — Supabase SQL para Mercado Ilha
-- Ejecutar este script en Supabase SQL Editor para añadir pagos, métricas,
-- auditoría y administración avanzada.

-- 1) Tablas de pago y transacciones
create table if not exists public.payment_methods (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  provider_payment_method_id text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, provider_payment_method_id)
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded','canceled')),
  provider text,
  provider_charge_id text,
  provider_payment_method_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id bigint generated always as identity primary key,
  code text not null unique,
  description text,
  discount_percent int check (discount_percent between 1 and 100),
  discount_amount numeric(12,2),
  active boolean not null default true,
  valid_from date,
  valid_until date,
  uses_limit int,
  uses_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_logs (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.payments(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- 2) Tablas de métricas y auditoría
create table if not exists public.listing_statistics (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  views_count bigint not null default 0,
  favorites_count bigint not null default 0,
  conversations_count bigint not null default 0,
  messages_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert','update','delete')),
  performed_by uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- 3) Triggers de updated_at
DROP TRIGGER IF EXISTS set_updated_at_payment_methods ON public.payment_methods;
create trigger set_updated_at_payment_methods
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
create trigger set_updated_at_payments
  before update on public.payments
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_promotions ON public.promotions;
create trigger set_updated_at_promotions
  before update on public.promotions
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_listing_statistics ON public.listing_statistics;
create trigger set_updated_at_listing_statistics
  before update on public.listing_statistics
  for each row execute function public.set_updated_at();

-- 4) Política RLS y autorizaciones
alter table public.payment_methods enable row level security;
create policy "Payment methods owner read" on public.payment_methods for select using (profile_id = auth.uid());
create policy "Payment methods owner write" on public.payment_methods for all using (profile_id = auth.uid() or public.is_admin());
create policy "Payment methods owner insert" on public.payment_methods for insert with check (profile_id = auth.uid());

alter table public.payments enable row level security;
create policy "Payments owner read" on public.payments for select using (
  buyer_profile_id = auth.uid() or seller_profile_id = auth.uid() or public.is_admin()
);
create policy "Payments owner insert" on public.payments for insert with check (buyer_profile_id = auth.uid());
create policy "Payments owner update" on public.payments for update using (
  buyer_profile_id = auth.uid() or seller_profile_id = auth.uid() or public.is_admin()
);
create policy "Payments admin delete" on public.payments for delete using (public.is_admin());

alter table public.promotions enable row level security;
create policy "Promotions public read" on public.promotions for select using (active and (valid_from is null or valid_from <= now()) and (valid_until is null or valid_until >= now()));
create policy "Promotions admin write" on public.promotions for all using (public.is_admin());

alter table public.payment_logs enable row level security;
create policy "Payment logs admin read" on public.payment_logs for select using (public.is_admin());
create policy "Payment logs admin insert" on public.payment_logs for insert with check (true);
create policy "Payment logs admin delete" on public.payment_logs for delete using (public.is_admin());

alter table public.listing_statistics enable row level security;
create policy "Listing statistics admin read" on public.listing_statistics for select using (public.is_admin());
create policy "Listing statistics admin write" on public.listing_statistics for all using (public.is_admin());

alter table public.audit_logs enable row level security;
create policy "Audit logs admin read" on public.audit_logs for select using (public.is_admin());
create policy "Audit logs admin insert" on public.audit_logs for insert with check (true);
create policy "Audit logs admin delete" on public.audit_logs for delete using (public.is_admin());

-- 5) Funciones de utilidades opcionales
create or replace function public.increment_promotion_use(promotion_code text) returns void language plpgsql as $$
begin
  update public.promotions
  set uses_count = uses_count + 1
  where code = promotion_code;
end;
$$;

create or replace function public.track_listing_view(_listing_id bigint, _profile_id uuid, _visitor_ip text, _visitor_device text) returns void language plpgsql as $$
begin
  insert into public.listing_views(listing_id, profile_id, visitor_ip, visitor_device)
  values (_listing_id, _profile_id, _visitor_ip, _visitor_device);
  insert into public.listing_statistics(listing_id, views_count)
  values (_listing_id, 1)
  on conflict (listing_id) do update set views_count = public.listing_statistics.views_count + 1, updated_at = now();
end;
$$;

-- 6) Notas
-- Ejecuta esta fase solo después de haber creado las tablas de fase 1 y fase 2.
