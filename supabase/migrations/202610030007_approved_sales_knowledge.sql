-- Approved business facts and multilingual sales guidance supplied for Maria.
insert into public.pricing_packages (name, description, price_cents, currency, billing_period, status, is_active)
select 'Treatment starting price', 'Approved starting monthly treatment price.', 26600, 'USD', 'monthly', 'published', true
where not exists (select 1 from public.pricing_packages where name = 'Treatment starting price');

insert into public.promotions (name, description, discount_type, discount_value, eligibility_conditions, starts_at, ends_at, status, is_active)
select 'October 2026 first-treatment offer', '10% off the customer''s first treatment.', 'percentage', 10, 'First treatment only.', '2026-10-01T00:00:00-04:00', '2026-11-01T00:00:00-04:00', 'published', true
where not exists (select 1 from public.promotions where name = 'October 2026 first-treatment offer');

insert into public.payment_methods (name, description, display_order, status, is_available)
select values_to_insert.name, 'Approved installment payment option.', values_to_insert.display_order, 'published', true
from (values ('Affirm', 1), ('Klarna', 2), ('Afterpay', 3), ('CareCredit', 4)) as values_to_insert(name, display_order)
where not exists (select 1 from public.payment_methods existing where lower(existing.name) = lower(values_to_insert.name));

insert into public.clinic_information (clinic_name, consultation_information, general_service_information, status)
select 'Dharma Nutrition Clinic', 'The first step is a 20-minute video call analysis, and it is 100% free.', 'Personalized weight-management consultation and treatment support.', 'published'
where not exists (select 1 from public.clinic_information where clinic_name = 'Dharma Nutrition Clinic');

insert into public.conversation_knowledge (title, description, category, content, language_code, keywords, priority, version, status)
select seed.title, seed.description, 'Customer Engagement', seed.content, seed.language_code, array['support', 'goal', 'consultation', 'sales guidance'], 100, '1.0', 'published'
from (values
  ('Supportive consultation guidance', 'Positive reinforcement and proactive, natural consultation guidance.', 'Acknowledge the customer''s goal warmly and specifically without promising outcomes. Explain that Dharma Clinic can help them explore available options, then guide them to the next unanswered stage. After confirmed delivery eligibility, introduce approved consultation and commercial information naturally over the conversation, without sounding scripted or repeating facts already communicated.', 'en'),
  ('Guía de consulta comprensiva', 'Refuerzo positivo y orientación natural hacia la consulta.', 'Reconoce la meta del cliente con calidez y sin prometer resultados. Explica que Dharma Clinic puede ayudarle a explorar las opciones disponibles y guíalo hacia la siguiente etapa pendiente. Después de confirmar la entrega, presenta naturalmente la consulta y la información comercial aprobada sin sonar robótica ni repetir datos ya comunicados.', 'es'),
  ('Orientação acolhedora para consulta', 'Reforço positivo e orientação natural para a consulta.', 'Reconheça a meta do cliente com entusiasmo e sem prometer resultados. Explique que a Dharma Clinic pode ajudar a explorar as opções disponíveis e conduza a pessoa à próxima etapa pendente. Depois de confirmar a entrega, apresente naturalmente a consulta e as informações comerciais aprovadas sem parecer um roteiro nem repetir dados já comunicados.', 'pt')
) as seed(title, description, content, language_code)
where not exists (select 1 from public.conversation_knowledge existing where existing.title = seed.title and existing.language_code = seed.language_code);

insert into public.conversation_scenarios (name, category, description, customer_message, trigger_description, conversation_context, expected_behavior, response_guidance, expected_next_action, language_code, keywords, priority, version, status)
select seed.name, 'Interrupted Conversation', seed.description, seed.customer_message, seed.customer_message, seed.context, seed.behavior, seed.guidance, seed.next_action, seed.language_code, array['interruption', 'questions', 'resume flow'], 100, '1.0', 'published'
from (values
  ('Answer interruptions then resume', 'Customer asks one or more questions during the consultation flow.', 'How much is it, and do you accept Klarna?', 'The customer interrupted an unfinished consultation explanation.', 'Answer every customer question first using approved retrieved facts. Then resume from the next important item that has not been communicated. Ask no more than one next-stage question.', 'Be concise and conversational. Never repeat the full sales introduction or force unrelated promotional information.', 'Resume the next incomplete consultation stage.', 'en'),
  ('Responder interrupciones y retomar', 'El cliente hace una o más preguntas durante la consulta.', '¿Cuánto cuesta y aceptan Klarna?', 'El cliente interrumpió una explicación de consulta pendiente.', 'Responde primero todas las preguntas con información aprobada. Después retoma el próximo dato importante que aún no se haya comunicado y haz como máximo una pregunta.', 'Mantén un tono natural y conciso. No repitas toda la introducción comercial.', 'Retomar la próxima etapa pendiente.', 'es'),
  ('Responder interrupções e retomar', 'O cliente faz uma ou mais perguntas durante a consulta.', 'Quanto custa e vocês aceitam Klarna?', 'O cliente interrompeu uma explicação de consulta ainda não concluída.', 'Responda primeiro a todas as perguntas usando informações aprovadas. Depois retome o próximo ponto importante ainda não comunicado e faça no máximo uma pergunta.', 'Mantenha um tom natural e conciso. Não repita toda a introdução comercial.', 'Retomar a próxima etapa pendente.', 'pt')
) as seed(name, description, customer_message, context, behavior, guidance, next_action, language_code)
where not exists (select 1 from public.conversation_scenarios existing where existing.name = seed.name and existing.language_code = seed.language_code);
