-- Milestone 3.4 additive conversation-knowledge fields.
alter table public.conversation_knowledge
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists priority integer not null default 0,
  add column if not exists version text;

update public.conversation_knowledge set category = topic where category is null and topic is not null;

alter table public.conversation_knowledge
  add constraint conversation_knowledge_language_check check (language_code in ('en', 'es', 'pt')),
  add constraint conversation_knowledge_priority_check check (priority >= 0);

alter table public.objection_handling
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists follow_up_question text,
  add column if not exists additional_context text,
  add column if not exists language_code varchar(5) not null default 'en',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists version text;

alter table public.objection_handling
  add constraint objection_handling_language_check check (language_code in ('en', 'es', 'pt'));

alter table public.conversation_scenarios
  add column if not exists category text,
  add column if not exists customer_message text,
  add column if not exists conversation_context text,
  add column if not exists expected_behavior text,
  add column if not exists expected_next_action text,
  add column if not exists language_code varchar(5) not null default 'en',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists priority integer not null default 0,
  add column if not exists version text;

alter table public.conversation_scenarios
  add constraint conversation_scenarios_language_check check (language_code in ('en', 'es', 'pt')),
  add constraint conversation_scenarios_priority_check check (priority >= 0);

create index conversation_knowledge_search_idx on public.conversation_knowledge(status, language_code, category, priority desc);
create index conversation_knowledge_keywords_idx on public.conversation_knowledge using gin(keywords);
create index objection_handling_search_idx on public.objection_handling(status, language_code, category, priority desc);
create index objection_handling_keywords_idx on public.objection_handling using gin(keywords);
create index conversation_scenarios_search_idx on public.conversation_scenarios(status, language_code, category, priority desc);
create index conversation_scenarios_keywords_idx on public.conversation_scenarios using gin(keywords);
