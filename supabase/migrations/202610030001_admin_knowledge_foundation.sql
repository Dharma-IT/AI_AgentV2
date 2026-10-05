-- Milestone 3.1 foundation. Review in a staging project before applying.
create extension if not exists pgcrypto;

create type public.knowledge_status as enum ('draft', 'published', 'archived');
create type public.admin_role as enum ('admin', 'editor', 'viewer');

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'viewer',
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  summary text,
  description text,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pricing_packages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency char(3) not null default 'USD',
  billing_period text check (billing_period in ('one_time', 'weekly', 'monthly', 'custom')),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text not null,
  discount_percent numeric(5,2) check (discount_percent between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  display_order integer not null default 0 check (display_order >= 0),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  state_code char(2) not null unique check (state_code ~ '^[A-Z]{2}$'),
  is_serviceable boolean not null default false,
  notes text,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  display_order integer not null default 0 check (display_order >= 0),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  topic text,
  language_code varchar(10) not null default 'en',
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.objection_handling (
  id uuid primary key default gen_random_uuid(),
  objection text not null,
  guidance text not null,
  priority integer not null default 0 check (priority >= 0),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_description text not null,
  response_guidance text not null,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rule_text text not null,
  severity text not null default 'required' check (severity in ('advisory', 'required', 'prohibited')),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.admin_users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'publish', 'archive', 'delete')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_status_idx on public.products(status);
create index pricing_packages_product_idx on public.pricing_packages(product_id);
create index pricing_packages_status_idx on public.pricing_packages(status);
create index promotions_status_dates_idx on public.promotions(status, starts_at, ends_at);
create index faqs_status_category_idx on public.faqs(status, category);
create index conversation_knowledge_status_topic_idx on public.conversation_knowledge(status, topic);
create index objection_handling_status_idx on public.objection_handling(status);
create index conversation_scenarios_status_idx on public.conversation_scenarios(status);
create index compliance_rules_status_idx on public.compliance_rules(status);
create index knowledge_documents_status_idx on public.knowledge_documents(status, processing_status);
create index knowledge_audit_logs_entity_idx on public.knowledge_audit_logs(entity_type, entity_id, created_at desc);
create index knowledge_audit_logs_actor_idx on public.knowledge_audit_logs(actor_id, created_at desc);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'admin_users', 'products', 'pricing_packages', 'promotions', 'payment_methods',
    'shipping_rules', 'faqs', 'conversation_knowledge', 'objection_handling',
    'conversation_scenarios', 'compliance_rules', 'knowledge_documents'
  ] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create function public.is_active_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active and role in ('admin', 'editor', 'viewer')
  );
$$;

create function public.can_edit_knowledge() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active and role in ('admin', 'editor')
  );
$$;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.pricing_packages enable row level security;
alter table public.promotions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.shipping_rules enable row level security;
alter table public.faqs enable row level security;
alter table public.conversation_knowledge enable row level security;
alter table public.objection_handling enable row level security;
alter table public.conversation_scenarios enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_audit_logs enable row level security;

create policy admin_users_read_self on public.admin_users for select using (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'products', 'pricing_packages', 'promotions', 'payment_methods', 'shipping_rules',
    'faqs', 'conversation_knowledge', 'objection_handling', 'conversation_scenarios',
    'compliance_rules', 'knowledge_documents'
  ] loop
    execute format('create policy %I_admin_read on public.%I for select using (public.is_active_admin())', table_name, table_name);
    execute format('create policy %I_editor_insert on public.%I for insert with check (public.can_edit_knowledge())', table_name, table_name);
    execute format('create policy %I_editor_update on public.%I for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge())', table_name, table_name);
    execute format('create policy %I_editor_delete on public.%I for delete using (public.can_edit_knowledge())', table_name, table_name);
  end loop;
end $$;

create policy audit_admin_read on public.knowledge_audit_logs for select using (public.is_active_admin());
create policy audit_editor_insert on public.knowledge_audit_logs for insert with check (public.can_edit_knowledge());

comment on function public.is_active_admin is 'RLS helper. Authenticated users must also have an active admin_users row.';
comment on table public.knowledge_audit_logs is 'Append-only audit events; updates and deletes have no client RLS policy.';
