-- Apply tourism-feedback.sql before this migration. That existing table is
-- intentionally retained and is not recreated here.
create extension if not exists pgcrypto;

do $$
declare
  table_name text;
begin
  if to_regclass('public.tourism_feedback') is null then
    raise exception 'Apply supabase/tourism-feedback.sql before the marketplace migration.';
  end if;

  foreach table_name in array array[
    'sites', 'vendors', 'listings', 'listing_images', 'qr_codes',
    'inquiries', 'admin_roles'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      raise exception 'public.% already exists. Inspect and reconcile it before applying this migration.', table_name;
    end if;
  end loop;
end;
$$;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  district text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null,
  tourism_category text not null,
  image_reference text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 120),
  owner_name text not null check (char_length(btrim(owner_name)) between 2 and 100),
  contact_number text not null check (
    contact_number ~ '^\+?[0-9 ()-]{10,18}$'
    and length(regexp_replace(contact_number, '[^0-9]', '', 'g')) between 10 and 15
  ),
  whatsapp_number text not null check (
    whatsapp_number ~ '^\+?[0-9 ()-]{10,18}$'
    and length(regexp_replace(whatsapp_number, '[^0-9]', '', 'g')) between 10 and 15
  ),
  default_category text check (default_category in ('guide', 'homestay', 'food', 'craft', 'culture')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  category text not null check (category in ('guide', 'homestay', 'food', 'craft', 'culture')),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  address text check (address is null or char_length(address) <= 300),
  service_area text check (service_area is null or char_length(service_area) <= 300),
  price_information text check (price_information is null or char_length(price_information) <= 200),
  specialty text check (specialty is null or char_length(specialty) <= 120),
  operating_hours text check (operating_hours is null or char_length(operating_hours) <= 120),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')),
  active boolean not null default false,
  review_feedback text check (review_feedback is null or char_length(review_feedback) <= 1000),
  reviewed_at timestamptz,
  reviewed_by_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_approved_active_check check (status <> 'APPROVED' or active)
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null check (char_length(btrim(alt_text)) between 1 and 200),
  sort_order smallint not null default 0 check (sort_order between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{3,100}$'),
  label text,
  active boolean not null default true,
  installation_status text not null default 'planned'
    check (installation_status in ('planned', 'unverified', 'installed')),
  installed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((installation_status = 'installed') = (installed_at is not null))
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  event_type text not null default 'inquiry' check (event_type in ('inquiry', 'whatsapp_click')),
  tourist_name text check (tourist_name is null or char_length(tourist_name) between 2 and 100),
  tourist_phone text check (
    tourist_phone is null or (
      tourist_phone ~ '^\+?[0-9 ()-]{10,18}$'
      and length(regexp_replace(tourist_phone, '[^0-9]', '', 'g')) between 10 and 15
    )
  ),
  message text check (message is null or char_length(message) <= 1000),
  source text not null default 'listing' check (source in ('listing', 'qr', 'ai')),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'whatsapp_click' and tourist_name is null and tourist_phone is null and message is null)
    or (event_type = 'inquiry' and tourist_name is not null and tourist_phone is not null)
  )
);

-- Custom Netlify admin sessions are not Supabase Auth sessions. This table
-- authorizes their SHA-256 user-ID hashes without exposing credentials.
create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  admin_identifier_hash text not null unique check (admin_identifier_hash ~ '^[a-f0-9]{64}$'),
  role text not null check (role in ('admin', 'moderator')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_public_site_category_idx
  on public.listings (site_id, category, updated_at desc)
  where status = 'APPROVED' and active;
create index listings_vendor_updated_idx on public.listings (vendor_id, updated_at desc);
create index listings_review_queue_idx on public.listings (created_at)
  where status = 'PENDING';
create index listing_images_listing_order_idx on public.listing_images (listing_id, sort_order);
create index qr_codes_site_active_idx on public.qr_codes (site_id) where active;
create index inquiries_listing_created_idx on public.inquiries (listing_id, created_at desc);
create index inquiries_created_idx on public.inquiries (created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sites_set_updated_at before update on public.sites
  for each row execute function public.set_updated_at();
create trigger vendors_set_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();
create trigger listing_images_set_updated_at before update on public.listing_images
  for each row execute function public.set_updated_at();
create trigger qr_codes_set_updated_at before update on public.qr_codes
  for each row execute function public.set_updated_at();
create trigger admin_roles_set_updated_at before update on public.admin_roles
  for each row execute function public.set_updated_at();

alter table public.tourism_feedback
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists tourism_feedback_set_updated_at on public.tourism_feedback;
create trigger tourism_feedback_set_updated_at
  before update on public.tourism_feedback
  for each row execute function public.set_updated_at();

create function public.create_vendor_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  business_name_value text := nullif(btrim(metadata ->> 'business_name'), '');
  owner_name_value text := nullif(btrim(metadata ->> 'owner_name'), '');
  contact_number_value text := nullif(btrim(metadata ->> 'contact_number'), '');
  whatsapp_number_value text := nullif(btrim(metadata ->> 'whatsapp_number'), '');
begin
  if metadata ->> 'account_type' is distinct from 'vendor' then
    return new;
  end if;
  if business_name_value is null
     or char_length(business_name_value) not between 2 and 120
     or owner_name_value is null
     or char_length(owner_name_value) not between 2 and 100
     or contact_number_value is null
     or contact_number_value !~ '^\+?[0-9 ()-]{10,18}$'
     or length(regexp_replace(contact_number_value, '[^0-9]', '', 'g')) not between 10 and 15
     or whatsapp_number_value is null
     or whatsapp_number_value !~ '^\+?[0-9 ()-]{10,18}$'
     or length(regexp_replace(whatsapp_number_value, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Vendor registration details are incomplete or invalid.';
  end if;
  insert into public.vendors (id, business_name, owner_name, contact_number, whatsapp_number)
  values (
    new.id,
    business_name_value,
    owner_name_value,
    contact_number_value,
    whatsapp_number_value
  );
  return new;
end;
$$;

insert into public.vendors (id, business_name, owner_name, contact_number, whatsapp_number)
select u.id,
  btrim(u.raw_user_meta_data ->> 'business_name'),
  btrim(u.raw_user_meta_data ->> 'owner_name'),
  btrim(u.raw_user_meta_data ->> 'contact_number'),
  btrim(u.raw_user_meta_data ->> 'whatsapp_number')
from auth.users u
where (
    u.raw_user_meta_data ->> 'account_type' = 'vendor'
    or nullif(btrim(u.raw_user_meta_data ->> 'business_name'), '') is not null
  )
  and char_length(btrim(coalesce(u.raw_user_meta_data ->> 'business_name', ''))) between 2 and 120
  and char_length(btrim(coalesce(u.raw_user_meta_data ->> 'owner_name', ''))) between 2 and 100
  and coalesce(u.raw_user_meta_data ->> 'contact_number', '') ~ '^\+?[0-9 ()-]{10,18}$'
  and length(regexp_replace(u.raw_user_meta_data ->> 'contact_number', '[^0-9]', '', 'g')) between 10 and 15
  and coalesce(u.raw_user_meta_data ->> 'whatsapp_number', '') ~ '^\+?[0-9 ()-]{10,18}$'
  and length(regexp_replace(u.raw_user_meta_data ->> 'whatsapp_number', '[^0-9]', '', 'g')) between 10 and 15
on conflict (id) do nothing;

create trigger on_auth_user_created_vendor
  after insert on auth.users
  for each row execute function public.create_vendor_profile();

create function public.submit_listing_for_review(p_listing_id uuid)
returns public.listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_listing public.listings;
begin
  perform set_config('ghoomoup.listing_transition', 'vendor_submit', true);
  update public.listings
  set status = 'PENDING', active = false, review_feedback = null, reviewed_at = null, reviewed_by_hash = null
  where id = p_listing_id
    and vendor_id = auth.uid()
    and status in ('DRAFT', 'PENDING', 'REJECTED', 'INACTIVE')
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing not found or cannot be submitted in its current state.';
  end if;
  return updated_listing;
end;
$$;
revoke all on function public.submit_listing_for_review(uuid) from public, anon;
grant execute on function public.submit_listing_for_review(uuid) to authenticated;

create function public.guard_vendor_listing_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.vendor_id <> auth.uid() or new.status <> 'DRAFT' or new.active then
        raise exception 'Vendors may only create their own inactive draft listings.';
      end if;
    else
      if new.vendor_id <> old.vendor_id then
        raise exception 'A listing owner cannot be changed.';
      end if;
      if new.status <> old.status
         and current_setting('ghoomoup.listing_transition', true) <> 'vendor_submit' then
        raise exception 'Listing status changes must use the review workflow.';
      end if;
      if (new.title, new.description, new.category, new.site_id, new.address,
          new.service_area, new.price_information, new.specialty, new.operating_hours)
         is distinct from
         (old.title, old.description, old.category, old.site_id, old.address,
          old.service_area, old.price_information, old.specialty, old.operating_hours)
         and old.status in ('APPROVED', 'REJECTED', 'INACTIVE') then
        new.status := case when old.status = 'APPROVED' then 'PENDING' else 'DRAFT' end;
        new.active := false;
        new.review_feedback := null;
        new.reviewed_at := null;
        new.reviewed_by_hash := null;
      end if;
    end if;
    if not exists (select 1 from public.sites s where s.id = new.site_id and s.active) then
      raise exception 'Listings must be associated with an active destination.';
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_guard_vendor_changes
  before insert or update on public.listings
  for each row execute function public.guard_vendor_listing_changes();

create function public.hide_listing_after_vendor_image_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_listing_id uuid;
begin
  if tg_op = 'DELETE' then
    target_listing_id := old.listing_id;
  else
    target_listing_id := new.listing_id;
  end if;
  if auth.role() = 'authenticated' then
    perform set_config('ghoomoup.listing_transition', 'vendor_submit', true);
    update public.listings
    set status = 'PENDING', active = false, review_feedback = null, reviewed_at = null, reviewed_by_hash = null
    where id = target_listing_id
      and vendor_id = auth.uid()
      and status = 'APPROVED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger listing_images_hide_approved_listing
  after insert or delete on public.listing_images
  for each row execute function public.hide_listing_after_vendor_image_change();

create function public.is_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles
    where admin_identifier_hash = (auth.jwt() -> 'app_metadata' ->> 'admin_identifier_hash')
      and is_active
      and role in ('admin', 'moderator')
  );
$$;
revoke all on function public.is_marketplace_admin() from public, anon;
grant execute on function public.is_marketplace_admin() to authenticated;

alter table public.sites enable row level security;
alter table public.vendors enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.qr_codes enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_roles enable row level security;

create policy "Active sites are public" on public.sites
  for select to anon, authenticated using (active);
create policy "Vendors read own profile" on public.vendors
  for select to authenticated using (id = (select auth.uid()));
create policy "Public reads contact fields for approved vendors" on public.vendors
  for select to anon, authenticated using (
    exists (
      select 1 from public.listings l
      where l.vendor_id = id and l.status = 'APPROVED' and l.active
    )
  );
create policy "Vendors create own profile" on public.vendors
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Vendors update own profile" on public.vendors
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Public reads approved active listings" on public.listings
  for select to anon, authenticated using (status = 'APPROVED' and active);
create policy "Vendors read own listings" on public.listings
  for select to authenticated using (vendor_id = (select auth.uid()));
create policy "Admins read all listings" on public.listings
  for select to authenticated using (public.is_marketplace_admin());
create policy "Vendors create own drafts" on public.listings
  for insert to authenticated with check (vendor_id = (select auth.uid()) and status = 'DRAFT' and not active);
create policy "Vendors update own listings" on public.listings
  for update to authenticated using (vendor_id = (select auth.uid()))
  with check (vendor_id = (select auth.uid()));
create policy "Admins update listings" on public.listings
  for update to authenticated using (public.is_marketplace_admin())
  with check (public.is_marketplace_admin());

create policy "Public reads approved listing images" on public.listing_images
  for select to anon, authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.status = 'APPROVED' and l.active)
  );
create policy "Vendors read own listing images" on public.listing_images
  for select to authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.vendor_id = (select auth.uid()))
  );
create policy "Vendors add images to own listings" on public.listing_images
  for insert to authenticated with check (
    storage_path like (select auth.uid())::text || '/' || listing_id::text || '/%'
    and exists (select 1 from public.listings l where l.id = listing_id and l.vendor_id = (select auth.uid()))
  );
create policy "Vendors remove own listing images" on public.listing_images
  for delete to authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.vendor_id = (select auth.uid()))
  );

create policy "Active QR routes are public" on public.qr_codes
  for select to anon, authenticated using (
    active and exists (select 1 from public.sites s where s.id = site_id and s.active)
  );
create policy "Admins manage QR routes" on public.qr_codes
  for all to authenticated using (public.is_marketplace_admin())
  with check (public.is_marketplace_admin());

create policy "Public records contact events" on public.inquiries
  for insert to anon, authenticated with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'APPROVED' and l.active
    )
    and (tourist_phone is null or tourist_phone ~ '^\+?[0-9 ()-]{10,18}$')
  );
create policy "Vendors read inquiries for own listings" on public.inquiries
  for select to authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.vendor_id = (select auth.uid()))
  );
create policy "Admins read inquiries" on public.inquiries
  for select to authenticated using (public.is_marketplace_admin());

-- Role assignments and admin contact data are only accessible to the server's
-- service-role key. Admin UI operations are proxied by the signed-cookie API.

create view public.public_listings
with (security_invoker = true)
as
select
  l.id,
  l.title,
  l.category,
  s.code as site_code,
  s.name as site_name,
  l.description,
  l.address,
  l.service_area,
  l.price_information,
  l.specialty,
  l.operating_hours,
  v.business_name,
  v.whatsapp_number,
  v.contact_number,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', image.id,
        'path', image.storage_path,
        'alt_text', image.alt_text,
        'sort_order', image.sort_order
      ) order by image.sort_order
    ) filter (where image.id is not null),
    '[]'::jsonb
  ) as images,
  l.updated_at
from public.listings l
join public.sites s on s.id = l.site_id and s.active
join public.vendors v on v.id = l.vendor_id
left join public.listing_images image on image.listing_id = l.id
where l.status = 'APPROVED' and l.active
group by l.id, s.id, v.id;

revoke all on public.sites, public.vendors, public.listings, public.listing_images,
  public.qr_codes, public.inquiries, public.admin_roles from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.sites, public.qr_codes, public.public_listings to anon, authenticated;
grant select, insert, update on public.vendors to authenticated;
grant select (id, business_name, contact_number, whatsapp_number) on public.vendors to anon, authenticated;
grant select (id, vendor_id, site_id, category, title, description, address, service_area,
  price_information, specialty, operating_hours, status, active, review_feedback,
  reviewed_at, created_at, updated_at) on public.listings to authenticated;
grant select (id, title, category, site_id, description, price_information, specialty,
  operating_hours, address, service_area, status, active, updated_at) on public.listings to anon, authenticated;
grant insert (vendor_id, site_id, category, title, description, address, service_area,
  price_information, specialty, operating_hours, status, active) on public.listings to authenticated;
revoke update on public.listings from authenticated;
grant update (site_id, category, title, description, address, service_area,
  price_information, specialty, operating_hours) on public.listings to authenticated;
grant select on public.listing_images to anon, authenticated;
grant insert, delete on public.listing_images to authenticated;
grant insert on public.inquiries to anon, authenticated;
grant select on public.inquiries to authenticated;
revoke all on public.admin_roles from anon, authenticated;

insert into public.sites (code, name, district, slug, description, tourism_category, image_reference)
values
  ('varanasi', 'Varanasi', 'Varanasi', 'varanasi',
   'Explore the riverfront, historic neighbourhoods and living cultural traditions of Varanasi.',
   'Heritage & Spirituality', 'assets/varanasi-illustration.svg'),
  ('ayodhya', 'Ayodhya', 'Ayodhya', 'ayodhya',
   'Discover Ayodhya’s heritage, riverside traditions and visitor experiences.',
   'Heritage & Spirituality', 'assets/ayodhya-illustration.svg'),
  ('prayagraj', 'Prayagraj', 'Prayagraj', 'prayagraj',
   'Explore Prayagraj’s river confluence, historic landmarks and cultural life.',
   'Heritage & Spirituality', 'assets/prayagraj-illustration.svg');

insert into public.qr_codes (site_id, code, label, installation_status)
select id, code, name || ' destination QR route', 'planned'
from public.sites;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Public reads approved listing image objects" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'listing-images'
    and exists (
      select 1
      from public.listing_images i
      join public.listings l on l.id = i.listing_id
      where i.storage_path = name
        and (l.status = 'APPROVED' and l.active or l.vendor_id = (select auth.uid()))
    )
  );
create policy "Vendors upload images to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Vendors update images in own folder" on storage.objects
  for update to authenticated using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Vendors delete images in own folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

