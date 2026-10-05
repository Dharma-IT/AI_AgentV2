create table public.respond_contact_automation (
  id uuid primary key default gen_random_uuid(),
  respond_contact_id text not null unique,
  contact_name text,
  mode text not null default 'maria' check (mode in ('maria', 'booked_agent', 'front_desk')),
  owner_respond_user_id bigint,
  owner_name text,
  preferred_language text check (preferred_language in ('en', 'es', 'pt')),
  evaluation_start_at timestamptz,
  evaluation_end_at timestamptz,
  locked_until timestamptz,
  last_event_id text,
  last_action text,
  reset_by uuid references public.admin_users(id) on delete set null,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index respond_contact_automation_mode_idx on public.respond_contact_automation(mode);
create index respond_contact_automation_locked_until_idx on public.respond_contact_automation(locked_until);
create trigger set_respond_contact_automation_updated_at before update on public.respond_contact_automation
for each row execute function public.set_updated_at();

create table public.respond_front_desk_rotation (
  singleton boolean primary key default true check (singleton),
  next_index integer not null default 0 check (next_index >= 0),
  updated_at timestamptz not null default now()
);
insert into public.respond_front_desk_rotation(singleton, next_index) values (true, 0);

create or replace function public.claim_next_front_desk_index(pool_size integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare claimed integer;
begin
  if pool_size < 1 then raise exception 'pool_size must be positive'; end if;
  update public.respond_front_desk_rotation
  set next_index = (next_index + 1) % pool_size, updated_at = now()
  where singleton = true
  returning (next_index + pool_size - 1) % pool_size into claimed;
  return claimed;
end;
$$;

alter table public.respond_contact_automation enable row level security;
alter table public.respond_front_desk_rotation enable row level security;
create policy respond_contact_automation_admin_read on public.respond_contact_automation
for select using (public.is_active_admin());
create policy respond_contact_automation_editor_update on public.respond_contact_automation
for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge());

comment on table public.respond_contact_automation is
'Durable Maria ownership, booking lock, and Front Desk handoff state per Respond.io contact.';
