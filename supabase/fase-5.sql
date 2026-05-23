-- FASE 5 — Supabase SQL para Mercado Ilha
-- Ejecutar este script en Supabase SQL Editor para ampliar el marketplace
-- con planes de suscripción, soporte al usuario, eventos de webhook y control administrativo.

-- 1) Planes de suscripción y membresías
create table if not exists public.subscription_plans (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  description text,
  price_monthly numeric(12,2) not null default 0,
  price_annual numeric(12,2),
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  trial_days int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_subscriptions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id bigint not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active','past_due','canceled','trialing','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  provider_subscription_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id)
);

-- 2) Soporte y tickets
create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3) Eventos de webhook y logs externos
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.external_logs (
  id bigint generated always as identity primary key,
  source text not null,
  level text not null check (level in ('info','warning','error','critical')),
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 4) Triggers de updated_at
DROP TRIGGER IF EXISTS set_updated_at_profile_subscriptions ON public.profile_subscriptions;
create trigger set_updated_at_profile_subscriptions
  before update on public.profile_subscriptions
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_support_tickets ON public.support_tickets;
create trigger set_updated_at_support_tickets
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_support_messages ON public.support_messages;
create trigger set_updated_at_support_messages
  before update on public.support_messages
  for each row execute function public.set_updated_at();

-- 5) Política RLS y administración
alter table public.subscription_plans enable row level security;
create policy "Subscription plans public read" on public.subscription_plans for select using (active);
create policy "Subscription plans admin write" on public.subscription_plans for all using (public.is_admin());

alter table public.profile_subscriptions enable row level security;
create policy "Profile subscriptions owner read" on public.profile_subscriptions for select using (profile_id = auth.uid() or public.is_admin());
create policy "Profile subscriptions owner insert" on public.profile_subscriptions for insert with check (profile_id = auth.uid());
create policy "Profile subscriptions owner update" on public.profile_subscriptions for update using (profile_id = auth.uid() or public.is_admin());
create policy "Profile subscriptions admin delete" on public.profile_subscriptions for delete using (public.is_admin());

alter table public.support_tickets enable row level security;
create policy "Support tickets owner read" on public.support_tickets for select using (profile_id = auth.uid() or assigned_to = auth.uid() or public.is_admin());
create policy "Support tickets owner insert" on public.support_tickets for insert with check (profile_id = auth.uid());
create policy "Support tickets owner update" on public.support_tickets for update using (profile_id = auth.uid() or assigned_to = auth.uid() or public.is_admin());
create policy "Support tickets admin delete" on public.support_tickets for delete using (public.is_admin());

alter table public.support_messages enable row level security;
create policy "Support messages participant read" on public.support_messages for select using (
  exists (
    select 1 from public.support_tickets t
    where t.id = public.support_messages.ticket_id
      and (t.profile_id = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
  )
);
create policy "Support messages owner insert" on public.support_messages for insert with check (sender_profile_id = auth.uid());
create policy "Support messages admin delete" on public.support_messages for delete using (public.is_admin());

alter table public.webhook_events enable row level security;
create policy "Webhook events admin read" on public.webhook_events for select using (public.is_admin());
create policy "Webhook events admin write" on public.webhook_events for insert with check (true);
create policy "Webhook events admin delete" on public.webhook_events for delete using (public.is_admin());

alter table public.external_logs enable row level security;
create policy "External logs admin read" on public.external_logs for select using (public.is_admin());
create policy "External logs admin insert" on public.external_logs for insert with check (true);
create policy "External logs admin delete" on public.external_logs for delete using (public.is_admin());

-- 6) Funciones de utilidad y notas
create or replace function public.log_external_event(source text, level text, msg text, payload jsonb) returns void language plpgsql as $$
begin
  insert into public.external_logs(source, level, message, payload)
  values (source, level, msg, payload);
end;
$$;

create or replace function public.record_webhook_event(event_type text, payload jsonb) returns void language plpgsql as $$
begin
  insert into public.webhook_events(event_type, payload)
  values (event_type, payload);
end;
$$;

-- Esta fase añade soporte y management para commerce avanzado.
-- Ejecuta después de las fases anteriores y usa `public.log_external_event()` y `public.record_webhook_event()`
-- desde tu backend o funciones edge para mantener trazabilidad.
