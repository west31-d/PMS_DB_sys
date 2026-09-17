-- Run after create_reservation.sql in the same rollback-only transaction.
UPDATE pms_private.development_access SET enabled = true WHERE singleton;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$
DECLARE
  payload jsonb := '{"property_id":-91701,"customer_name":"개발용 로그인 없는 예약","check_in":"2099-05-01","check_out":"2099-05-02","rooms":[{"room_type_id":-91701,"room_id":-91701,"rate_amount":80000}],"charges":[]}';
  result jsonb;
  again jsonb;
BEGIN
  IF NOT public.pms_development_mode() THEN RAISE EXCEPTION 'Development mode not enabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.property WHERE property_id = -91701) THEN RAISE EXCEPTION 'Anonymous cannot read development data'; END IF;
  result := public.pms_create_reservation('91700000-0000-4000-8000-000000000077', payload);
  again := public.pms_create_reservation('91700000-0000-4000-8000-000000000077', payload);
  IF result <> again THEN RAISE EXCEPTION 'Anonymous retry created a duplicate'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservation WHERE reservation_id = (result->>'reservation_id')::bigint) THEN RAISE EXCEPTION 'Saved development reservation not visible'; END IF;
END $$;
RESET ROLE;
UPDATE pms_private.development_access SET enabled = false WHERE singleton;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF public.pms_development_mode() THEN RAISE EXCEPTION 'Development mode still enabled'; END IF;
  IF EXISTS (SELECT 1 FROM public.property) OR EXISTS (SELECT 1 FROM public.customer) OR EXISTS (SELECT 1 FROM public.reservation) THEN RAISE EXCEPTION 'Anonymous reads remain enabled'; END IF;
  BEGIN
    PERFORM public.pms_create_reservation(gen_random_uuid(), '{"property_id":-91701}');
    RAISE EXCEPTION 'Anonymous write remains enabled';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
