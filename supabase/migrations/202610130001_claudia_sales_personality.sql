alter table public.respond_channel_policies
  rename column enabled to maria_enabled;

alter table public.respond_channel_policies
  add column claudia_enabled boolean not null default false,
  add constraint respond_channel_single_personality
    check (not (maria_enabled and claudia_enabled));

drop index if exists respond_channel_policies_enabled_idx;
create index respond_channel_policies_maria_enabled_idx on public.respond_channel_policies(maria_enabled);
create index respond_channel_policies_claudia_enabled_idx on public.respond_channel_policies(claudia_enabled);

create table public.bot_settings (
  personality text primary key check (personality in ('claudia')),
  sales_url text,
  updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sales_url is null or sales_url ~ '^https://')
);

insert into public.bot_settings (personality, sales_url)
values ('claudia', 'https://dharmanutritionclinic.store/products/inyecciones-glp-1-personalizadas-para-perder-peso');

insert into public.conversation_knowledge
  (title, description, category, content, language_code, keywords, priority, version, status)
values
  ('Claudia VIP Dharma Program', 'Approved sales-program facts for Claudia.', 'Product Communication',
   'The VIP Dharma Program includes 1:1 customer support, personalized support, medical supervision throughout the full program, a nutritional guide, and an exercise guide. Medication is shipped from a USA-based 503(a) pharmacy. If clinically approved, the order ships within 3-5 business days. Semaglutide starts at $199 and Tirzepatide starts at $299. Clinical approval is required.',
   'en', array['claudia','vip dharma','semaglutide','tirzepatide'], 100, '1', 'published'),
  ('Programa VIP Dharma de Claudia', 'Información comercial aprobada para Claudia.', 'Product Communication',
   'El Programa VIP Dharma incluye atención 1:1 con soporte al cliente, apoyo personalizado, supervisión médica durante todo el programa, guía nutricional y guía de ejercicios. Los medicamentos se envían desde una farmacia 503(a) con sede en EE. UU. Si recibe aprobación clínica, el pedido se envía en 3-5 días hábiles. Semaglutida desde $199 y Tirzepatida desde $299. Se requiere aprobación clínica.',
   'es', array['claudia','vip dharma','semaglutida','tirzepatida'], 100, '1', 'published'),
  ('Programa VIP Dharma da Claudia', 'Informações comerciais aprovadas para Claudia.', 'Product Communication',
   'O Programa VIP Dharma inclui atendimento individual com o suporte ao cliente, suporte personalizado, supervisão médica durante todo o programa, guia nutricional e guia de exercícios. Os medicamentos são enviados por uma farmácia 503(a) sediada nos EUA. Se houver aprovação clínica, o pedido será enviado em 3-5 dias úteis. Semaglutida a partir de US$ 199 e Tirzepatida a partir de US$ 299. A aprovação clínica é obrigatória.',
   'pt', array['claudia','vip dharma','semaglutida','tirzepatida'], 100, '1', 'published');

create trigger set_bot_settings_updated_at before update on public.bot_settings
for each row execute function public.set_updated_at();

alter table public.bot_settings enable row level security;
create policy bot_settings_admin_read on public.bot_settings
for select using (public.is_active_admin());
create policy bot_settings_editor_update on public.bot_settings
for update using (public.can_edit_knowledge()) with check (public.can_edit_knowledge());

comment on table public.bot_settings is 'Administrator-managed runtime settings for bot personalities.';
