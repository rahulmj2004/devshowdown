-- DevShowdown: multi-event registration and payments.
-- Run after 0001_init.sql, in the Supabase SQL editor or with `supabase db push`.
--
-- Access model (nothing here is reachable with the anon key)
--   participants, registrations, registration_events, team_members,
--   payment_orders, payment_transactions, payment_webhook_events
--       Row Level Security on, no anon or participant policies. Rows are
--       written only by the server (service role) through the functions below
--       and read only by organizers (public.is_admin()).
--
-- Money is stored as integer paise. No card numbers, CVVs, UPI handles or any
-- other payment credentials are ever stored: only the gateway's order and
-- payment identifiers.

-- ------------------------------------------- keep the v1 table, out of the way --
-- 0001 created a one-row-per-event `registrations` table. Its rows (if any) are
-- preserved under a new name; organizers can still read them.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name = 'event_slug'
  ) then
    alter table public.registrations rename to registrations_v1_legacy;
    alter table public.registrations_v1_legacy
      rename constraint registrations_pkey to registrations_v1_legacy_pkey;
    alter index if exists public.registrations_email_event_key
      rename to registrations_v1_email_event_key;
    alter index if exists public.registrations_event_slug_idx
      rename to registrations_v1_event_slug_idx;
  end if;
end $$;

-- ----------------------------------------------------------- participants ----
-- One row per person, keyed by email. The application lower-cases the address
-- before it gets here; the check keeps it that way.
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null
    check (char_length(email) between 3 and 254 and email = lower(email)),
  organization text not null check (char_length(organization) between 2 and 120),
  phone text check (phone is null or char_length(phone) between 7 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_email_key unique (email)
);

-- ---------------------------------------------------------- registrations ----
-- One submission of the registration flow: a participant entering one or more
-- events, with a single amount payable.
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  -- Public reference shown to the participant, e.g. DSD-7K2M9QXA.
  reference text not null
    check (reference ~ '^[A-Z]{3,4}-[A-Z0-9]{8}$'),
  participant_id uuid not null references public.participants (id) on delete restrict,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'superseded')),
  payment_status text not null default 'pending'
    check (payment_status in
      ('not_required', 'pending', 'paid', 'failed', 'verification_required')),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  -- SHA-256 of a random key generated in the participant's browser. It makes
  -- submission idempotent and is the bearer credential for reading the
  -- registration back. The key itself is never stored.
  client_key_hash text not null check (client_key_hash ~ '^[a-f0-9]{64}$'),
  -- True when "paid" through the development mock gateway. Never real money.
  is_test boolean not null default false,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint registrations_reference_key unique (reference),
  constraint registrations_client_key_hash_key unique (client_key_hash),
  constraint registrations_confirmed_has_timestamp
    check ((status = 'confirmed') = (confirmed_at is not null)),
  constraint registrations_free_means_not_required
    check ((amount_paise = 0) = (payment_status = 'not_required')),
  -- A registration is confirmed exactly when nothing is owed: either nothing
  -- was payable, or the payment has been verified.
  constraint registrations_confirmed_iff_settled
    check ((status = 'confirmed') = (payment_status in ('not_required', 'paid')))
);

create index if not exists registrations_participant_idx
  on public.registrations (participant_id);
create index if not exists registrations_review_idx
  on public.registrations (payment_status)
  where payment_status = 'verification_required';

-- ---------------------------------------------------- registration_events ----
create table if not exists public.registration_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete restrict,
  event_slug text not null check (char_length(event_slug) between 1 and 80),
  team_name text check (team_name is null or char_length(team_name) between 2 and 60),
  fee_paise integer not null check (fee_paise >= 0),
  -- False once the registration it belongs to has been superseded.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint registration_events_once_per_registration
    unique (registration_id, event_slug)
);

-- One live entry per person per event. This is what makes a double submission
-- impossible even if two requests race.
create unique index if not exists registration_events_one_active_entry
  on public.registration_events (participant_id, event_slug)
  where active;
create index if not exists registration_events_event_idx
  on public.registration_events (event_slug);

-- ----------------------------------------------------------- team_members ----
-- Additional team members. The registrant is the participant, not a row here.
-- Only a name is collected.
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  registration_event_id uuid not null
    references public.registration_events (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  full_name text not null check (char_length(full_name) between 2 and 100),
  constraint team_members_position_key unique (registration_event_id, position)
);

-- --------------------------------------------------------- payment_orders ----
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete restrict,
  provider text not null check (provider in ('razorpay', 'mock')),
  provider_order_id text not null check (char_length(provider_order_id) between 1 and 120),
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_provider_order_key unique (provider, provider_order_id)
);

-- At most one usable order per registration. A retry reuses it, so a
-- participant can never end up holding two payable orders.
create unique index if not exists payment_orders_one_open_per_registration
  on public.payment_orders (registration_id)
  where status in ('created', 'paid');

-- --------------------------------------------------- payment_transactions ----
-- Payments the server has verified (signature and gateway status), or seen
-- fail. Never inserted on the browser's say-so.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders (id) on delete restrict,
  registration_id uuid not null references public.registrations (id) on delete restrict,
  provider text not null check (provider in ('razorpay', 'mock')),
  provider_payment_id text not null check (char_length(provider_payment_id) between 1 and 120),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null,
  status text not null check (status in ('captured', 'authorized', 'failed')),
  method text check (method is null or char_length(method) <= 40),
  verified_via text not null
    check (verified_via in ('checkout_signature', 'webhook', 'mock')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_provider_payment_key
    unique (provider, provider_payment_id)
);

create index if not exists payment_transactions_registration_idx
  on public.payment_transactions (registration_id);

-- ------------------------------------------------- payment_webhook_events ----
-- One row per webhook delivery id. The unique key is what makes redelivered
-- webhooks harmless. Only a hash of the payload is kept.
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay')),
  event_id text not null check (char_length(event_id) between 1 and 200),
  event_type text not null check (char_length(event_type) <= 80),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (outcome is null or char_length(outcome) <= 80),
  constraint payment_webhook_events_delivery_key unique (provider, event_id)
);

-- ---------------------------------------------------- row level security ----
do $$
declare
  t text;
begin
  foreach t in array array[
    'participants', 'registrations', 'registration_events', 'team_members',
    'payment_orders', 'payment_transactions', 'payment_webhook_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- No policy exists for anon or for ordinary signed-in users, and the table
    -- grants are removed as well, as defence in depth.
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('drop policy if exists "Organizers can read %s" on public.%I', t, t);
    execute format(
      'create policy "Organizers can read %s" on public.%I for select to authenticated using (public.is_admin())',
      t, t
    );
  end loop;
end $$;

-- Flat, organizer-only view for the dashboard and the CSV export.
-- security_invoker makes it obey the policies above for whoever queries it.
create or replace view public.admin_registration_entries
with (security_invoker = true) as
select
  re.id,
  r.reference,
  r.status,
  r.payment_status,
  r.amount_paise,
  r.is_test,
  re.active,
  p.full_name,
  p.email,
  p.organization,
  p.phone,
  re.event_slug,
  re.team_name,
  re.fee_paise,
  (
    select coalesce(array_agg(tm.full_name order by tm.position), '{}')
    from public.team_members tm
    where tm.registration_event_id = re.id
  ) as team_members,
  r.created_at
from public.registration_events re
join public.registrations r on r.id = re.registration_id
join public.participants p on p.id = r.participant_id;

revoke all on public.admin_registration_entries from anon;
grant select on public.admin_registration_entries to authenticated;

-- ------------------------------------------------------------- functions ----
-- Everything below runs as the caller and is executable by the service role
-- only. Each function is one transaction.

-- The registration as the application sees it. `payment_reference` is the
-- gateway payment id of the captured payment, if there is one.
create or replace function public.registration_snapshot(p_registration_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'reference', r.reference,
    'status', r.status,
    'payment_status', r.payment_status,
    'amount_paise', r.amount_paise,
    'currency', r.currency,
    'is_test', r.is_test,
    'created_at', r.created_at,
    'confirmed_at', r.confirmed_at,
    'participant', jsonb_build_object(
      'full_name', p.full_name,
      'email', p.email,
      'organization', p.organization,
      'phone', p.phone
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_slug', re.event_slug,
          'team_name', re.team_name,
          'fee_paise', re.fee_paise,
          'members', coalesce((
            select jsonb_agg(tm.full_name order by tm.position)
            from public.team_members tm
            where tm.registration_event_id = re.id
          ), '[]'::jsonb)
        )
        order by re.created_at, re.event_slug
      )
      from public.registration_events re
      where re.registration_id = r.id
    ), '[]'::jsonb),
    'payment_reference', (
      select t.provider_payment_id
      from public.payment_transactions t
      where t.registration_id = r.id and t.status = 'captured'
      order by t.created_at desc
      limit 1
    )
  )
  from public.registrations r
  join public.participants p on p.id = r.participant_id
  where r.id = p_registration_id;
$$;

-- Looks a registration up by its reference AND the hash of the browser key.
-- Knowing the reference alone reveals nothing.
create or replace function public.find_registration(
  p_reference text,
  p_client_key_hash text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.registration_snapshot(r.id)
  from public.registrations r
  where r.reference = p_reference and r.client_key_hash = p_client_key_hash;
$$;

-- Creates a registration with its events and team members.
--   outcome 'created'    a new registration
--   outcome 'existing'   the same browser key was submitted before (a retry or
--                        double click): the original is returned, nothing new
--   outcome 'duplicate'  the participant already holds a confirmed entry for
--                        one of the events; `event_slugs` lists them
-- An unfinished (unpaid) earlier attempt by the same participant for any of
-- the same events is marked 'superseded' so the new one can take its place.
create or replace function public.create_registration(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_hash text := p ->> 'client_key_hash';
  v_email text := lower(p -> 'participant' ->> 'email');
  v_amount integer := (p ->> 'amount_paise')::integer;
  v_slugs text[];
  v_participant uuid;
  v_existing uuid;
  v_registration uuid;
  v_duplicates text[];
  v_entry jsonb;
  v_entry_id uuid;
  v_member text;
  v_position integer;
begin
  select id into v_existing
  from public.registrations where client_key_hash = v_hash;
  if v_existing is not null then
    return jsonb_build_object(
      'outcome', 'existing',
      'registration', public.registration_snapshot(v_existing)
    );
  end if;

  select array_agg(entry ->> 'event_slug') into v_slugs
  from jsonb_array_elements(p -> 'entries') entry;
  if v_slugs is null then
    raise exception 'A registration needs at least one event';
  end if;

  -- Details are refreshed on a retry, but never once the participant holds a
  -- confirmed registration, so nobody else can rewrite a confirmed entry by
  -- submitting the same email address.
  insert into public.participants (full_name, email, organization, phone)
  values (
    p -> 'participant' ->> 'full_name',
    v_email,
    p -> 'participant' ->> 'organization',
    p -> 'participant' ->> 'phone'
  )
  on conflict (email) do update
    set full_name = excluded.full_name,
        organization = excluded.organization,
        phone = excluded.phone,
        updated_at = now()
    where not exists (
      select 1 from public.registrations r
      where r.participant_id = participants.id and r.status = 'confirmed'
    )
  returning id into v_participant;

  -- Serialise everything else per participant.
  select id into v_participant
  from public.participants where email = v_email for update;

  -- A concurrent identical request may have finished while we waited.
  select id into v_existing
  from public.registrations where client_key_hash = v_hash;
  if v_existing is not null then
    return jsonb_build_object(
      'outcome', 'existing',
      'registration', public.registration_snapshot(v_existing)
    );
  end if;

  select array_agg(re.event_slug order by re.event_slug) into v_duplicates
  from public.registration_events re
  join public.registrations r on r.id = re.registration_id
  where re.participant_id = v_participant
    and re.active
    and r.status = 'confirmed'
    and re.event_slug = any (v_slugs);
  if v_duplicates is not null then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'event_slugs', to_jsonb(v_duplicates)
    );
  end if;

  with stale as (
    update public.registrations r
    set status = 'superseded', updated_at = now()
    where r.participant_id = v_participant
      and r.status = 'pending_payment'
      and exists (
        select 1 from public.registration_events re
        where re.registration_id = r.id
          and re.active
          and re.event_slug = any (v_slugs)
      )
    returning r.id
  )
  update public.registration_events re
  set active = false
  where re.registration_id in (select id from stale);

  insert into public.registrations (
    reference, participant_id, status, payment_status, amount_paise,
    client_key_hash, is_test, consent_at, confirmed_at
  )
  values (
    p ->> 'reference',
    v_participant,
    case when v_amount = 0 then 'confirmed' else 'pending_payment' end,
    case when v_amount = 0 then 'not_required' else 'pending' end,
    v_amount,
    v_hash,
    coalesce((p ->> 'is_test')::boolean, false),
    (p ->> 'consent_at')::timestamptz,
    case when v_amount = 0 then now() end
  )
  returning id into v_registration;

  for v_entry in select * from jsonb_array_elements(p -> 'entries') loop
    insert into public.registration_events (
      registration_id, participant_id, event_slug, team_name, fee_paise
    )
    values (
      v_registration,
      v_participant,
      v_entry ->> 'event_slug',
      v_entry ->> 'team_name',
      (v_entry ->> 'fee_paise')::integer
    )
    returning id into v_entry_id;

    v_position := 0;
    for v_member in
      select * from jsonb_array_elements_text(
        coalesce(v_entry -> 'members', '[]'::jsonb)
      )
    loop
      v_position := v_position + 1;
      insert into public.team_members (registration_event_id, position, full_name)
      values (v_entry_id, v_position, v_member);
    end loop;
  end loop;

  return jsonb_build_object(
    'outcome', 'created',
    'registration', public.registration_snapshot(v_registration)
  );
end;
$$;

-- Records a payment the server has already verified, and settles the
-- registration. Safe to call any number of times, in any order, from the
-- checkout callback and from webhooks.
--   'confirmed'              captured, amounts match: registration confirmed
--   'already_confirmed'      this registration was already settled
--   'pending'                authorized but not captured yet
--   'failed'                 the attempt failed; the order stays open for a retry
--   'verification_required'  amount/currency mismatch, or money arrived for a
--                            superseded registration: organizers must review
--   'order_not_found'        no such order
create or replace function public.record_payment(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_order public.payment_orders;
  v_registration public.registrations;
  v_status text := p ->> 'status';
  v_outcome text;
begin
  select * into v_order
  from public.payment_orders
  where provider = p ->> 'provider'
    and provider_order_id = p ->> 'provider_order_id'
  for update;
  if not found then
    return jsonb_build_object('outcome', 'order_not_found', 'registration', null);
  end if;

  select * into v_registration
  from public.registrations where id = v_order.registration_id for update;

  if v_status not in ('captured', 'authorized', 'failed') then
    raise exception 'Unknown payment status %', v_status;
  end if;

  if v_status <> 'failed' and (
    (p ->> 'amount_paise')::integer <> v_order.amount_paise
    or upper(p ->> 'currency') <> v_order.currency
  ) then
    -- Money that does not match the order is never treated as payment.
    update public.registrations
    set payment_status = 'verification_required', updated_at = now()
    where id = v_registration.id and status <> 'confirmed';
    return jsonb_build_object(
      'outcome', 'verification_required',
      'registration', public.registration_snapshot(v_registration.id)
    );
  end if;

  insert into public.payment_transactions (
    order_id, registration_id, provider, provider_payment_id,
    amount_paise, currency, status, method, verified_via
  )
  values (
    v_order.id,
    v_registration.id,
    v_order.provider,
    p ->> 'provider_payment_id',
    (p ->> 'amount_paise')::integer,
    upper(p ->> 'currency'),
    v_status,
    p ->> 'method',
    p ->> 'verified_via'
  )
  on conflict (provider, provider_payment_id) do update
    -- A captured payment never goes backwards.
    set status = case
          when public.payment_transactions.status = 'captured' then 'captured'
          else excluded.status
        end,
        updated_at = now();

  if v_registration.status = 'confirmed' then
    v_outcome := 'already_confirmed';
  elsif v_status = 'failed' then
    update public.registrations
    set payment_status = 'failed', updated_at = now()
    where id = v_registration.id and payment_status in ('pending', 'failed');
    v_outcome := 'failed';
  elsif v_status = 'authorized' then
    update public.registrations
    set payment_status = 'verification_required', updated_at = now()
    where id = v_registration.id;
    v_outcome := 'pending';
  elsif v_registration.status = 'superseded' then
    update public.registrations
    set payment_status = 'verification_required', updated_at = now()
    where id = v_registration.id;
    v_outcome := 'verification_required';
  else
    update public.payment_orders
    set status = 'paid', updated_at = now()
    where id = v_order.id;
    update public.registrations
    set status = 'confirmed',
        payment_status = 'paid',
        confirmed_at = now(),
        updated_at = now()
    where id = v_registration.id;
    v_outcome := 'confirmed';
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'registration', public.registration_snapshot(v_registration.id)
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.registration_snapshot(uuid)',
    'public.find_registration(text, text)',
    'public.create_registration(jsonb)',
    'public.record_payment(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
