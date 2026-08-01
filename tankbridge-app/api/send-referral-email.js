-- ============================== Migration #64 ==============================
-- ============================================================================
-- TANKBRIDGE — Migration #64
-- New "representation confirmation" check, separate from the existing
-- seller price-confirmation and hand-off claim flows. Fires the first time
-- a REAL counterparty (a different company) engages a "I know them
-- directly" referred company's listing (buyer or seller, whichever side)
-- with an offer or counter — at that point, we email the referred company
-- at the address the referring broker gave, asking them to confirm this
-- broker actually represents them. Non-blocking (informational) for now —
-- it does not stop the negotiation, but flags unconfirmed/rejected
-- representation for admin review.
-- Supabase Dashboard → SQL Editor → New query → 전체 붙여넣고 Run
-- ============================================================================

alter table public.referrals add column if not exists rep_confirm_status text
  check (rep_confirm_status in ('pending', 'confirmed', 'rejected'));
alter table public.referrals add column if not exists rep_confirm_token uuid default gen_random_uuid();
alter table public.referrals add column if not exists rep_confirm_reason text;
alter table public.referrals add column if not exists rep_confirm_email_status text;
alter table public.referrals add column if not exists rep_confirm_email_sent_at timestamptz;
alter table public.referrals add column if not exists rep_confirm_email_error text;

create index if not exists idx_referrals_rep_confirm_token on public.referrals(rep_confirm_token);

-- trigger_rep_confirm_if_needed(): called right after a real counterparty
-- submits their first offer/counter on a directly-registered company's
-- listing. Finds the matching "I know them directly" referral for that
-- company (claiming_broker_id is null — hand-off referrals already have
-- their own verified claim flow and are skipped) and flips it to 'pending'
-- the first time this happens. Returns what the caller needs to send the
-- confirmation email; does nothing (should_send = false) if there's no such
-- referral, or one is already pending/resolved.
create or replace function public.trigger_rep_confirm_if_needed(p_company_id uuid)
returns table (should_send boolean, referral_id uuid, token uuid, contact_email text, broker_name text, referred_company_name text, referred_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_broker public.companies%rowtype;
begin
  select r.* into v_referral from public.referrals r
    where r.company_id = p_company_id and r.claiming_broker_id is null and r.status = 'approved'
    order by r.created_at desc limit 1;

  if not found or v_referral.rep_confirm_status is not null or coalesce(nullif(v_referral.referred_email, ''), '') = '' then
    return query select false, null::uuid, null::uuid, null::text, null::text, null::text, null::text;
    return;
  end if;

  update public.referrals set rep_confirm_status = 'pending' where id = v_referral.id;
  select * into v_broker from public.companies where id = v_referral.broker_company_id;

  return query select true, v_referral.id, v_referral.rep_confirm_token, v_referral.referred_email,
                      coalesce(v_broker.company_name, 'A broker'), v_referral.referred_company_name, v_referral.referred_type;
end;
$$;
grant execute on function public.trigger_rep_confirm_if_needed(uuid) to authenticated;

-- get_rep_confirm_by_token(): for the public confirm/reject page (no login).
create or replace function public.get_rep_confirm_by_token(p_token uuid)
returns table (id uuid, referred_type text, referred_company_name text, broker_name text, rep_confirm_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select r.id, r.referred_type, r.referred_company_name, coalesce(b.company_name, 'A broker'), r.rep_confirm_status
    from public.referrals r left join public.companies b on b.id = r.broker_company_id
    where r.rep_confirm_token = p_token;
end;
$$;
grant execute on function public.get_rep_confirm_by_token(uuid) to anon, authenticated;

-- confirm_rep(): the referred company confirms or denies the broker
-- actually represents them, via the emailed magic link (no login needed).
create or replace function public.confirm_rep(p_token uuid, p_confirmed boolean, p_reason text default null)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
begin
  select * into v_referral from public.referrals where rep_confirm_token = p_token;
  if not found then raise exception 'Invalid or expired link.'; end if;
  if v_referral.rep_confirm_status <> 'pending' then raise exception 'This has already been responded to.'; end if;

  update public.referrals set
    rep_confirm_status = case when p_confirmed then 'confirmed' else 'rejected' end,
    rep_confirm_reason = case when p_confirmed then null else p_reason end
  where id = v_referral.id
  returning * into v_referral;

  return v_referral;
end;
$$;
grant execute on function public.confirm_rep(uuid, boolean, text) to anon, authenticated;
