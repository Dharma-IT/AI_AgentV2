-- Defense in depth: verify the source is still published at query time.
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
    (1 - (ke.embedding <=> query_embedding))::double precision
  from public.knowledge_embeddings ke
  where ke.status = 'ready' and ke.embedding is not null
    and (filter_language is null or ke.language_code = filter_language)
    and 1 - (ke.embedding <=> query_embedding) >= match_threshold
    and case ke.source_type
      when 'conversation_knowledge' then exists (select 1 from public.conversation_knowledge s where s.id = ke.source_id and s.status = 'published')
      when 'objection_handling' then exists (select 1 from public.objection_handling s where s.id = ke.source_id and s.status = 'published')
      when 'conversation_scenarios' then exists (select 1 from public.conversation_scenarios s where s.id = ke.source_id and s.status = 'published')
      else false
    end
  order by ke.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_knowledge_embeddings(extensions.vector, double precision, integer, text) from public, anon, authenticated;
grant execute on function public.match_knowledge_embeddings(extensions.vector, double precision, integer, text) to service_role;
