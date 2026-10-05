-- Milestone 3.5: approved semantic knowledge embeddings and vector search.
create extension if not exists vector with schema extensions;

alter table public.compliance_rules
  add column if not exists is_active boolean not null default true;
create index if not exists compliance_rules_active_status_idx on public.compliance_rules(is_active, status, severity);

create table public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('conversation_knowledge', 'objection_handling', 'conversation_scenarios')),
  source_id uuid not null,
  source_content text not null,
  content_hash text not null,
  language_code varchar(5) not null check (language_code in ('en', 'es', 'pt')),
  embedding extensions.vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index knowledge_embeddings_source_idx on public.knowledge_embeddings(source_type, source_id);
create index knowledge_embeddings_status_language_idx on public.knowledge_embeddings(status, language_code);
create index knowledge_embeddings_vector_idx on public.knowledge_embeddings
  using hnsw (embedding extensions.vector_cosine_ops) where status = 'ready';

create trigger set_knowledge_embeddings_updated_at before update on public.knowledge_embeddings
  for each row execute function public.set_updated_at();

alter table public.knowledge_embeddings enable row level security;
create policy knowledge_embeddings_admin_read on public.knowledge_embeddings
  for select using (public.is_active_admin());

create or replace function public.match_knowledge_embeddings(
  query_embedding extensions.vector(1536),
  match_threshold double precision,
  match_count integer,
  filter_language text default null
) returns table (
  id uuid,
  source_type text,
  source_id uuid,
  source_content text,
  language_code varchar(5),
  similarity double precision
) language sql stable security definer set search_path = public, extensions as $$
  select ke.id, ke.source_type, ke.source_id, ke.source_content, ke.language_code,
    (1 - (ke.embedding <=> query_embedding))::double precision as similarity
  from public.knowledge_embeddings ke
  where ke.status = 'ready'
    and ke.embedding is not null
    and (filter_language is null or ke.language_code = filter_language)
    and 1 - (ke.embedding <=> query_embedding) >= match_threshold
  order by ke.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_knowledge_embeddings(extensions.vector, double precision, integer, text) from public, anon, authenticated;
grant execute on function public.match_knowledge_embeddings(extensions.vector, double precision, integer, text) to service_role;

comment on table public.knowledge_embeddings is 'Embeddings of published admin-managed conversational guidance only; never customer messages.';
