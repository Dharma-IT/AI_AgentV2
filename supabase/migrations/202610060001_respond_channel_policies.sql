create table public.respond_channel_policies (
  id uuid primary key default gen_random_uuid(),
  respond_channel_id bigint not null unique,
  channel_name text not null,
  source text not null,
  enabled boolean not null default false,
  last_seen_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index respond_channel_policies_source_idx on public.respond_channel_policies(source);
create index respond_channel_policies_enabled_idx on public.respond_channel_policies(enabled);
create trigger set_respond_channel_policies_updated_at before update on public.respond_channel_policies
for each row execute function public.set_updated_at();

alter table public.respond_channel_policies enable row level security;
create policy respond_channel_policies_admin_read on public.respond_channel_policies
for select using (public.is_active_admin());
create policy respond_channel_policies_editor_update on public.respond_channel_policies
for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge());

comment on table public.respond_channel_policies is
'Respond.io channel allowlist. Newly synchronized channels default to disabled.';
