update public.conversation_knowledge
set content = replace(replace(content, 'Clinical approval', 'Medical approval'), 'clinical approval', 'medical approval')
where title in ('Claudia VIP Dharma Program', 'Programa VIP Dharma de Claudia', 'Programa VIP Dharma da Claudia');

update public.conversation_knowledge
set content = replace(replace(content, 'aprobación clínica', 'aprobación médica'), 'aprovação clínica', 'aprovação médica')
where title in ('Programa VIP Dharma de Claudia', 'Programa VIP Dharma da Claudia');

delete from public.knowledge_embeddings
where source_type = 'conversation_knowledge'
  and source_id in (
    select id from public.conversation_knowledge
    where title in ('Claudia VIP Dharma Program', 'Programa VIP Dharma de Claudia', 'Programa VIP Dharma da Claudia')
  );
