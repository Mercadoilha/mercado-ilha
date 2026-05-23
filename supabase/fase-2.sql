-- FASE 2 — Supabase SQL para Mercado Ilha
-- Ejecutar este script en Supabase SQL Editor para extender la plataforma
-- con funciones de interacción, favoritos, mensajes y métricas.

-- 1) Tablas de interacción
create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id bigint not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(profile_id, listing_id)
);

create table if not exists public.conversations (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed','archived')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_views (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  visited_at timestamptz not null default now(),
  visitor_ip text,
  visitor_device text
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(listing_id, reviewer_profile_id)
);

-- 2) Triggers para nuevos registros con updated_at
DROP TRIGGER IF EXISTS set_updated_at_conversations ON public.conversations;
create trigger set_updated_at_conversations
  before update on public.conversations
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_notifications ON public.notifications;
create trigger set_updated_at_notifications
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- 3) RLS y políticas
alter table public.favorites enable row level security;
create policy "Favorites owner read" on public.favorites for select using (profile_id = auth.uid());
create policy "Favorites owner insert" on public.favorites for insert with check (profile_id = auth.uid());
create policy "Favorites owner delete" on public.favorites for delete using (profile_id = auth.uid() or public.is_admin());
create policy "Favorites admin manage" on public.favorites for all using (public.is_admin());

alter table public.conversations enable row level security;
create policy "Conversations participants read" on public.conversations for select using (
  buyer_profile_id = auth.uid() or seller_profile_id = auth.uid() or public.is_admin()
);
create policy "Conversations participant insert" on public.conversations for insert with check (
  buyer_profile_id = auth.uid() or seller_profile_id = auth.uid()
);
create policy "Conversations participant update" on public.conversations for update using (
  buyer_profile_id = auth.uid() or seller_profile_id = auth.uid() or public.is_admin()
);
create policy "Conversations participant delete" on public.conversations for delete using (public.is_admin());

alter table public.messages enable row level security;
create policy "Messages participant read" on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = public.messages.conversation_id
      and (c.buyer_profile_id = auth.uid() or c.seller_profile_id = auth.uid() or public.is_admin())
  )
);
create policy "Messages participant insert" on public.messages for insert with check (
  sender_profile_id = auth.uid()
);
create policy "Messages participant delete" on public.messages for delete using (public.is_admin());

alter table public.listing_views enable row level security;
create policy "Listing views public insert" on public.listing_views for insert with check (true);
create policy "Listing views admin read" on public.listing_views for select using (public.is_admin());
create policy "Listing views admin delete" on public.listing_views for delete using (public.is_admin());

alter table public.notifications enable row level security;
create policy "Notifications owner read" on public.notifications for select using (profile_id = auth.uid());
create policy "Notifications owner update" on public.notifications for update using (profile_id = auth.uid());
create policy "Notifications owner insert" on public.notifications for insert with check (profile_id = auth.uid());
create policy "Notifications owner delete" on public.notifications for delete using (profile_id = auth.uid() or public.is_admin());

alter table public.reviews enable row level security;
create policy "Reviews public read" on public.reviews for select using (true);
create policy "Reviews insert" on public.reviews for insert with check (reviewer_profile_id = auth.uid());
create policy "Reviews update" on public.reviews for update using (reviewer_profile_id = auth.uid() or public.is_admin());
create policy "Reviews delete" on public.reviews for delete using (reviewer_profile_id = auth.uid() or public.is_admin());

-- 4) Datos iniciales opcionales
-- No se insertan datos de seed en fase 2, esta fase se centra en la estructura.
