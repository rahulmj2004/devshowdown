-- Behavioural checks for 0002_registration_payments.sql.
-- Run with `npm run test:db` (needs a local Postgres; see scripts/test-db.sh).
\set ON_ERROR_STOP on
\set QUIET on
-- Results are reported through NOTICEs; discard the row output.
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok   %', label;
end $$;

create function pg_temp.payload(
  key_hash text, reference text, email text, slugs text[], amount integer
) returns jsonb language sql as $$
  select jsonb_build_object(
    'reference', reference,
    'client_key_hash', key_hash,
    'amount_paise', amount,
    'is_test', false,
    'consent_at', now(),
    'participant', jsonb_build_object(
      'full_name', 'Asha Menon', 'email', email,
      'organization', 'Example College', 'phone', null),
    'entries', (
      select jsonb_agg(jsonb_build_object(
        'event_slug', s, 'team_name', 'Null Pointers',
        'fee_paise', amount / array_length(slugs, 1),
        'members', jsonb_build_array('Ravi Kumar', 'Meera Nair')))
      from unnest(slugs) s)
  );
$$;

set role service_role;

-- ------------------------------------------------- free registration ----
select pg_temp.check('free registration is confirmed immediately',
  r -> 'registration' ->> 'status' = 'confirmed'
  and r -> 'registration' ->> 'payment_status' = 'not_required'
  and r ->> 'outcome' = 'created')
from public.create_registration(
  pg_temp.payload(repeat('a', 64), 'DSD-FREE0001', 'free@example.com',
    array['speed-typing'], 0)) r;

select pg_temp.check('team members are stored in order',
  r -> 'entries' -> 0 -> 'members' = '["Ravi Kumar", "Meera Nair"]'::jsonb)
from public.find_registration('DSD-FREE0001', repeat('a', 64)) r;

select pg_temp.check('the reference alone does not reveal a registration',
  public.find_registration('DSD-FREE0001', repeat('f', 64)) is null);

-- ------------------------------------------------------- idempotency ----
select pg_temp.check('resubmitting the same key returns the original',
  r ->> 'outcome' = 'existing'
  and r -> 'registration' ->> 'reference' = 'DSD-FREE0001')
from public.create_registration(
  pg_temp.payload(repeat('a', 64), 'DSD-FREE9999', 'free@example.com',
    array['speed-typing'], 0)) r;

select pg_temp.check('no second registration row was created',
  (select count(*) from public.registrations) = 1);

select pg_temp.check('a confirmed entry cannot be registered twice',
  r ->> 'outcome' = 'duplicate'
  and r -> 'event_slugs' = '["speed-typing"]'::jsonb)
from public.create_registration(
  pg_temp.payload(repeat('b', 64), 'DSD-FREE0002', 'free@example.com',
    array['speed-typing', 'blind-coding'], 0)) r;

-- --------------------------------------------------- paid registration ----
select pg_temp.check('a paid registration starts pending',
  r -> 'registration' ->> 'status' = 'pending_payment'
  and r -> 'registration' ->> 'payment_status' = 'pending')
from public.create_registration(
  pg_temp.payload(repeat('c', 64), 'DSD-PAID0001', 'paid@example.com',
    array['code-debugging', 'coding-challenge'], 20000)) r;

insert into public.payment_orders (registration_id, provider, provider_order_id, amount_paise)
select id, 'razorpay', 'order_A', 20000 from public.registrations where reference = 'DSD-PAID0001';

do $$
begin
  insert into public.payment_orders (registration_id, provider, provider_order_id, amount_paise)
  select id, 'razorpay', 'order_A2', 20000 from public.registrations where reference = 'DSD-PAID0001';
  raise exception 'FAILED: a second open order was accepted';
exception when unique_violation then
  raise notice 'ok   a registration cannot hold two open orders';
end $$;

select pg_temp.check('a failed attempt marks the payment failed, not the order',
  r ->> 'outcome' = 'failed'
  and r -> 'registration' ->> 'payment_status' = 'failed'
  and (select status from public.payment_orders where provider_order_id = 'order_A') = 'created')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_fail', 'amount_paise', 20000, 'currency', 'INR',
  'status', 'failed', 'verified_via', 'webhook')) r;

select pg_temp.check('a wrong amount is never accepted as payment',
  r ->> 'outcome' = 'verification_required'
  and r -> 'registration' ->> 'status' = 'pending_payment')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_short', 'amount_paise', 100, 'currency', 'INR',
  'status', 'captured', 'verified_via', 'webhook')) r;

select pg_temp.check('the mismatched payment was not recorded as a transaction',
  not exists (select 1 from public.payment_transactions where provider_payment_id = 'pay_short'));

select pg_temp.check('an authorized payment waits for capture',
  r ->> 'outcome' = 'pending'
  and r -> 'registration' ->> 'payment_status' = 'verification_required')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_ok', 'amount_paise', 20000, 'currency', 'INR',
  'status', 'authorized', 'verified_via', 'checkout_signature')) r;

select pg_temp.check('capture confirms the registration',
  r ->> 'outcome' = 'confirmed'
  and r -> 'registration' ->> 'status' = 'confirmed'
  and r -> 'registration' ->> 'payment_status' = 'paid'
  and r -> 'registration' ->> 'payment_reference' = 'pay_ok')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_ok', 'amount_paise', 20000, 'currency', 'INR',
  'status', 'captured', 'verified_via', 'webhook')) r;

select pg_temp.check('a redelivered capture changes nothing',
  r ->> 'outcome' = 'already_confirmed'
  and (select count(*) from public.payment_transactions where provider_payment_id = 'pay_ok') = 1)
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_ok', 'amount_paise', 20000, 'currency', 'INR',
  'status', 'captured', 'verified_via', 'webhook')) r;

select pg_temp.check('a late failure webhook cannot undo a confirmed payment',
  r ->> 'outcome' = 'already_confirmed'
  and r -> 'registration' ->> 'payment_status' = 'paid')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_A',
  'provider_payment_id', 'pay_fail', 'amount_paise', 20000, 'currency', 'INR',
  'status', 'failed', 'verified_via', 'webhook')) r;

select pg_temp.check('an unknown order is reported, not invented',
  r ->> 'outcome' = 'order_not_found')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_nope',
  'provider_payment_id', 'pay_x', 'amount_paise', 1, 'currency', 'INR',
  'status', 'captured', 'verified_via', 'webhook')) r;

-- ------------------------------------------- abandoned attempt, then retry ----
select public.create_registration(
  pg_temp.payload(repeat('d', 64), 'DSD-OLD00001', 'retry@example.com',
    array['blind-coding'], 10000));
insert into public.payment_orders (registration_id, provider, provider_order_id, amount_paise)
select id, 'razorpay', 'order_old', 10000 from public.registrations where reference = 'DSD-OLD00001';

-- A statement cannot see changes made by a function it calls, so the call and
-- the checks on what it changed are separate statements.
create temp table retry_result as
select public.create_registration(
  pg_temp.payload(repeat('e', 64), 'DSD-NEW00001', 'retry@example.com',
    array['blind-coding'], 10000)) as r;

select pg_temp.check('a new attempt replaces an unpaid earlier one',
  (select r ->> 'outcome' from retry_result) = 'created'
  and (select status from public.registrations where reference = 'DSD-OLD00001') = 'superseded'
  and (select count(*) from public.registration_events re
       join public.participants p on p.id = re.participant_id
       where p.email = 'retry@example.com' and re.active) = 1);

select pg_temp.check('money arriving for a superseded attempt is flagged for review',
  r ->> 'outcome' = 'verification_required'
  and r -> 'registration' ->> 'status' = 'superseded'
  and r -> 'registration' ->> 'payment_status' = 'verification_required')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_old',
  'provider_payment_id', 'pay_late', 'amount_paise', 10000, 'currency', 'INR',
  'status', 'captured', 'verified_via', 'webhook')) r;

-- ---------------------------------------------------- webhook dedupe ----
insert into public.payment_webhook_events (provider, event_id, event_type, payload_sha256)
values ('razorpay', 'evt_1', 'payment.captured', repeat('0', 64));
do $$
begin
  insert into public.payment_webhook_events (provider, event_id, event_type, payload_sha256)
  values ('razorpay', 'evt_1', 'payment.captured', repeat('0', 64));
  raise exception 'FAILED: a duplicate webhook delivery was stored';
exception when unique_violation then
  raise notice 'ok   a webhook delivery id can only be stored once';
end $$;

-- -------------------------------------------------------- constraints ----
do $$
begin
  update public.registrations set payment_status = 'paid' where reference = 'DSD-NEW00001';
  raise exception 'FAILED: an unconfirmed registration was marked paid';
exception when check_violation then
  raise notice 'ok   "paid" is impossible without a confirmed registration';
end $$;

reset role;

-- ------------------------------------------------ access control (RLS) ----
set role anon;
do $$
declare
  t text;
begin
  foreach t in array array['participants', 'registrations', 'registration_events',
    'team_members', 'payment_orders', 'payment_transactions',
    'payment_webhook_events', 'admin_registration_entries'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'FAILED: anon could read %', t;
    exception when insufficient_privilege then
      raise notice 'ok   anon cannot read %', t;
    end;
  end loop;
  begin
    perform public.find_registration('DSD-FREE0001', repeat('a', 64));
    raise exception 'FAILED: anon could call find_registration';
  exception when insufficient_privilege then
    raise notice 'ok   anon cannot call the registration functions';
  end;
end $$;
reset role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'visitor@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'organizer@example.com');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000002');

set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
select pg_temp.check('a signed-in non-organizer sees no registrations',
  (select count(*) from public.registrations) = 0
  and (select count(*) from public.admin_registration_entries) = 0
  and (select count(*) from public.payment_transactions) = 0);
do $$
begin
  insert into public.participants (full_name, email, organization)
  values ('Mallory', 'mallory@example.com', 'Nowhere');
  raise exception 'FAILED: a signed-in user could insert a participant';
exception when insufficient_privilege then
  raise notice 'ok   signed-in users cannot write participants';
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
select pg_temp.check('an organizer sees every entry, with its payment state',
  (select count(*) from public.admin_registration_entries) = 5
  and (select count(*) from public.admin_registration_entries
       where reference = 'DSD-PAID0001' and payment_status = 'paid') = 2);
reset role;

\o
\echo 'All database checks passed.'
