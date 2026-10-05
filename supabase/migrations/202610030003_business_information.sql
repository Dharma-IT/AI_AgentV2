-- Milestone 3.3 additive business-information schema.
alter table public.shipping_rules
  add column if not exists state_name text,
  add column if not exists description text,
  add column if not exists estimated_delivery_timeframe text,
  add column if not exists restrictions text,
  add column if not exists is_active boolean not null default true;

alter table public.faqs
  add column if not exists keywords text[] not null default '{}',
  add column if not exists language_code varchar(5) not null default 'en';

alter table public.faqs
  add constraint faqs_language_check check (language_code in ('en', 'es', 'pt'));

create table public.clinic_information (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  description text,
  location text,
  contact_information text,
  operating_hours text,
  consultation_information text,
  general_service_information text,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  additional_information text,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  content text not null,
  applicable_conditions text,
  effective_at timestamptz,
  expires_at timestamptz,
  language_code varchar(5) not null default 'en',
  version text,
  status public.knowledge_status not null default 'draft',
  created_by uuid references public.admin_users(id) on delete set null,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_policies_language_check check (language_code in ('en', 'es', 'pt')),
  constraint business_policies_dates_check check (expires_at is null or effective_at is null or expires_at > effective_at)
);

create index shipping_rules_active_status_idx on public.shipping_rules(is_active, status, is_serviceable);
create index faqs_publication_idx on public.faqs(status, language_code, category);
create index faqs_keywords_idx on public.faqs using gin(keywords);
create index clinic_information_status_idx on public.clinic_information(status);
create index business_policies_publication_idx on public.business_policies(status, language_code, category, effective_at, expires_at);

create trigger set_clinic_information_updated_at before update on public.clinic_information for each row execute function public.set_updated_at();
create trigger set_business_policies_updated_at before update on public.business_policies for each row execute function public.set_updated_at();

alter table public.clinic_information enable row level security;
alter table public.business_policies enable row level security;

create policy clinic_information_admin_read on public.clinic_information for select using (public.is_active_admin());
create policy clinic_information_editor_insert on public.clinic_information for insert with check (public.can_edit_knowledge());
create policy clinic_information_editor_update on public.clinic_information for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge());
create policy clinic_information_editor_delete on public.clinic_information for delete using (public.can_edit_knowledge());
create policy business_policies_admin_read on public.business_policies for select using (public.is_active_admin());
create policy business_policies_editor_insert on public.business_policies for insert with check (public.can_edit_knowledge());
create policy business_policies_editor_update on public.business_policies for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge());
create policy business_policies_editor_delete on public.business_policies for delete using (public.can_edit_knowledge());
