-- Behavioural checks for 0003_upi_payments.sql.
-- Run with `npm run test:db` (needs a local Postgres; see scripts/test-db.sh).
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok   %', label;
end $$;

create function pg_temp.register(key_char text, reference text, email text)
returns jsonb language sql as $$
  select public.create_registration(jsonb_build_object(
    'reference', reference,
    'client_key_hash', repeat(key_char, 64),
    'amount_paise', 10000,
    'is_test', false,
    'consent_at', now(),
    'participant', jsonb_build_object(
      'full_name', 'Asha Menon', 'email', email,
      'organization', 'Example College', 'phone', null),
    'entries', jsonb_build_array(jsonb_build_object(
      'event_slug', 'debugging', 'team_name', null,
      'fee_paise', 10000, 'members', '[]'::jsonb))));
$$;

create function pg_temp.upi(order_id text, utr text, status text, via text)
returns jsonb language sql as $$
  select public.record_payment(jsonb_build_object(
    'provider', 'upi', 'provider_order_id', order_id,
    'provider_payment_id', utr, 'amount_paise', 10000, 'currency', 'INR',
    'status', status, 'method', 'upi', 'verified_via', via));
$$;

set role service_role;

select pg_temp.register('1', 'DSD-UPI00001', 'upi-one@example.com');
select pg_temp.register('2', 'DSD-UPI00002', 'upi-two@example.com');
insert into public.payment_orders (registration_id, provider, provider_order_id, amount_paise)
select id, 'upi', 'upi_' || reference, 10000
from public.registrations where reference in ('DSD-UPI00001', 'DSD-UPI00002');

-- ------------------------------------------------- a claim is only a claim ----
select pg_temp.check('a reported UPI payment waits for review, unconfirmed',
  r ->> 'outcome' = 'pending'
  and r -> 'registration' ->> 'status' = 'pending_payment'
  and r -> 'registration' ->> 'payment_status' = 'verification_required'
  and r -> 'registration' ->> 'payment_reference' is null)
from pg_temp.upi('upi_DSD-UPI00001', '412345678901', 'authorized', 'participant') r;

select pg_temp.check('the claim is what the organizer is shown',
  c ->> 'provider_order_id' = 'upi_DSD-UPI00001'
  and c ->> 'provider_payment_id' = '412345678901'
  and (c ->> 'amount_paise')::integer = 10000)
from public.find_payment_claim('DSD-UPI00001') c;

select pg_temp.check('a registration with no claim has nothing to review',
  public.find_payment_claim('DSD-UPI00002') is null);

-- ----------------------------------------- one transaction ID, one order ----
select pg_temp.check('a transaction ID cannot be reused for another registration',
  r ->> 'outcome' = 'payment_id_in_use'
  and r -> 'registration' ->> 'payment_status' = 'pending')
from pg_temp.upi('upi_DSD-UPI00002', '412345678901', 'authorized', 'participant') r;

select pg_temp.check('the reused ID left the first claim untouched',
  (select count(*) from public.payment_transactions
   where provider = 'upi' and provider_payment_id = '412345678901') = 1
  and public.find_payment_claim('DSD-UPI00002') is null);

-- ------------------------------------------------------ reject, then retry ----
select pg_temp.check('rejecting a claim reopens the registration',
  r ->> 'outcome' = 'failed'
  and r -> 'registration' ->> 'status' = 'pending_payment'
  and r -> 'registration' ->> 'payment_status' = 'failed')
from pg_temp.upi('upi_DSD-UPI00001', '412345678901', 'failed', 'organizer') r;

select pg_temp.check('a rejected claim is no longer waiting for review',
  public.find_payment_claim('DSD-UPI00001') is null);

select pg_temp.upi('upi_DSD-UPI00001', '498765432109', 'authorized', 'participant');

select pg_temp.check('the corrected transaction ID is the one under review',
  c ->> 'provider_payment_id' = '498765432109')
from public.find_payment_claim('DSD-UPI00001') c;

-- ---------------------------------------------------------------- approve ----
select pg_temp.check('approving a claim confirms the registration',
  r ->> 'outcome' = 'confirmed'
  and r -> 'registration' ->> 'status' = 'confirmed'
  and r -> 'registration' ->> 'payment_status' = 'paid'
  and r -> 'registration' ->> 'payment_reference' = '498765432109')
from pg_temp.upi('upi_DSD-UPI00001', '498765432109', 'captured', 'organizer') r;

select pg_temp.check('approving twice changes nothing',
  r ->> 'outcome' = 'already_confirmed')
from pg_temp.upi('upi_DSD-UPI00001', '498765432109', 'captured', 'organizer') r;

select pg_temp.check('a confirmed registration cannot be rejected afterwards',
  r -> 'registration' ->> 'status' = 'confirmed'
  and r -> 'registration' ->> 'payment_status' = 'paid')
from pg_temp.upi('upi_DSD-UPI00001', '498765432109', 'failed', 'organizer') r;

-- A Razorpay failure must still not reopen a payment held for review.
select pg_temp.register('3', 'DSD-RZP00003', 'rzp-three@example.com');
insert into public.payment_orders (registration_id, provider, provider_order_id, amount_paise)
select id, 'razorpay', 'order_rzp3', 10000 from public.registrations where reference = 'DSD-RZP00003';
select public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_rzp3',
  'provider_payment_id', 'pay_rzp3a', 'amount_paise', 10000, 'currency', 'INR',
  'status', 'authorized', 'verified_via', 'webhook'));
select pg_temp.check('gateway payments keep their existing review rule',
  r -> 'registration' ->> 'payment_status' = 'verification_required')
from public.record_payment(jsonb_build_object(
  'provider', 'razorpay', 'provider_order_id', 'order_rzp3',
  'provider_payment_id', 'pay_rzp3b', 'amount_paise', 10000, 'currency', 'INR',
  'status', 'failed', 'verified_via', 'webhook')) r;

reset role;

-- ------------------------------------------------------------- access ----
set role anon;
do $$
begin
  perform public.find_payment_claim('DSD-UPI00001');
  raise exception 'FAILED: anon could read a payment claim';
exception when insufficient_privilege then
  raise notice 'ok   anon cannot read payment claims';
end $$;
reset role;

select pg_temp.check('the organizer view shows the approved transaction ID',
  (select upi_transaction_id from public.admin_registration_entries
   where reference = 'DSD-UPI00001') = '498765432109'
  and (select upi_transaction_id from public.admin_registration_entries
       where reference = 'DSD-UPI00002') is null);

\o
\echo 'All UPI database checks passed.'
