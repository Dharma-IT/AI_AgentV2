-- Milestone 3.2 additive commercial-management fields.
alter table public.products
  add column if not exists treatment_category text,
  add column if not exists detailed_information text,
  add column if not exists is_active boolean not null default true;

alter table public.pricing_packages
  add column if not exists effective_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists is_active boolean not null default true;

alter table public.pricing_packages
  add constraint pricing_packages_valid_dates
  check (expires_at is null or effective_at is null or expires_at > effective_at);

alter table public.promotions
  add column if not exists discount_type text not null default 'percentage',
  add column if not exists discount_value numeric(12,2),
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists pricing_package_id uuid references public.pricing_packages(id) on delete set null,
  add column if not exists eligibility_conditions text,
  add column if not exists is_active boolean not null default true;

update public.promotions
set discount_value = discount_percent
where discount_value is null and discount_percent is not null;

alter table public.promotions
  add constraint promotions_discount_type_check check (discount_type in ('percentage', 'fixed_amount')),
  add constraint promotions_discount_value_check check (
    discount_value is null or
    (discount_type = 'percentage' and discount_value between 0 and 100) or
    (discount_type = 'fixed_amount' and discount_value >= 0)
  );

alter table public.payment_methods
  add column if not exists is_available boolean not null default true,
  add column if not exists restrictions text;

create index if not exists products_active_status_idx on public.products(is_active, status);
create index if not exists pricing_active_status_idx on public.pricing_packages(is_active, status);
create index if not exists promotions_active_validity_idx on public.promotions(is_active, status, starts_at, ends_at);
create index if not exists promotions_product_idx on public.promotions(product_id);
create index if not exists promotions_package_idx on public.promotions(pricing_package_id);
create index if not exists payment_methods_available_status_idx on public.payment_methods(is_available, status);
