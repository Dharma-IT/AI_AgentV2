alter table public.respond_contact_automation
add column maria_greeting_sent_at timestamptz;

comment on column public.respond_contact_automation.maria_greeting_sent_at is
'When Maria sent the approved introductory greeting through Respond.io.';
