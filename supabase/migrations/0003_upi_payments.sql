-- DevShowdown: direct UPI payments, verified by an organizer.
-- Run after 0002_registration_payments.sql. Safe to run more than once.
--
-- A participant pays the organizers' UPI ID from their own app and types in
-- the transaction ID from the receipt. That is stored as an 'authorized'
-- transaction (a claim, never proof) and the registration waits in
-- 'verification_required' until an organizer approves or rejects it from the
-- dashboard. Only the transaction ID is stored: never a UPI handle or PIN.

-- ---------------------------------------------- allow the 'upi' provider ----
alter table public.payment_orders
  drop constraint if exists payment_orders_provider_check;
alter table public.payment_orders
  add constraint payment_orders_provider_check
  check (provider in ('razorpay', 'upi', 'mock'));

alter table public.payment_transactions
  drop constraint if exists payment_transactions_provider_check;
alter table public.payment_transactions
  add constraint payment_transactions_provider_check
  check (provider in ('razorpay', 'upi', 'mock'));

-- 'participant' is a payer's own claim; 'organizer' is the manual decision.
alter table public.payment_transactions
  drop constraint if exists payment_transactions_verified_via_check;
alter table public.payment_transactions
  add constraint payment_transactions_verified_via_check
  check (verified_via in
    ('checkout_signature', 'webhook', 'mock', 'participant', 'organizer'));

-- --------------------------------------------------------- record_payment ----
-- As in 0002, with two additions:
--   'payment_id_in_use'  that payment id is already recorded against another
--                        order, so nothing is changed. This stops one UPI
--                        transaction ID being used for two registrations.
--   a 'failed' UPI payment also reopens a registration that was waiting in
--   'verification_required', which is how an organizer rejects a claim.
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

  -- A payment id belongs to one order. Reusing it elsewhere changes nothing.
  if exists (
    select 1 from public.payment_transactions t
    where t.provider = v_order.provider
      and t.provider_payment_id = p ->> 'provider_payment_id'
      and t.order_id <> v_order.id
  ) then
    return jsonb_build_object(
      'outcome', 'payment_id_in_use',
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
        verified_via = excluded.verified_via,
        updated_at = now();

  if v_registration.status = 'confirmed' then
    v_outcome := 'already_confirmed';
  elsif v_status = 'failed' then
    update public.registrations
    set payment_status = 'failed', updated_at = now()
    where id = v_registration.id
      and (
        payment_status in ('pending', 'failed')
        or (v_order.provider = 'upi' and payment_status = 'verification_required')
      );
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

-- ------------------------------------------------------ find_payment_claim ----
-- The UPI claim waiting for an organizer on one registration, if there is one.
create or replace function public.find_payment_claim(p_reference text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'provider_order_id', o.provider_order_id,
    'provider_payment_id', t.provider_payment_id,
    'amount_paise', o.amount_paise,
    'currency', o.currency
  )
  from public.registrations r
  join public.payment_transactions t on t.registration_id = r.id
  join public.payment_orders o on o.id = t.order_id
  where r.reference = p_reference
    and r.payment_status = 'verification_required'
    and t.provider = 'upi'
    and t.status = 'authorized'
  order by t.updated_at desc
  limit 1;
$$;

revoke all on function public.find_payment_claim(text) from public, anon, authenticated;
grant execute on function public.find_payment_claim(text) to service_role;

-- ------------------------------------------------- organizer view: add UTR ----
-- Same columns as 0002, plus the UPI transaction ID the participant entered
-- (the newest claim, or the approved one).
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
  r.created_at,
  (
    select t.provider_payment_id
    from public.payment_transactions t
    where t.registration_id = r.id
      and t.provider = 'upi'
      and t.status in ('authorized', 'captured')
    order by (t.status = 'captured') desc, t.updated_at desc
    limit 1
  ) as upi_transaction_id
from public.registration_events re
join public.registrations r on r.id = re.registration_id
join public.participants p on p.id = r.participant_id;

revoke all on public.admin_registration_entries from anon;
grant select on public.admin_registration_entries to authenticated;
