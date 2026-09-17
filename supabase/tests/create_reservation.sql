-- Run in a transaction and ROLLBACK. Fixture IDs are outside operational IDs.
INSERT INTO auth.users(id, email, email_confirmed_at) VALUES
('91700000-0000-4000-8000-000000000001', 'reservation-test@example.invalid', now());
INSERT INTO public.property(property_id, property_name) VALUES (-91701, '예약 테스트'), (-91702, '권한 외 호텔');
INSERT INTO public.room_type(room_type_id, property_id, room_type_name) VALUES (-91701, -91701, '테스트 타입');
INSERT INTO public.room(room_id, property_id, room_type_id, room_number, housekeeping_status) VALUES
(-91701, -91701, -91701, 'TEST1', '정비완료'), (-91702, -91701, -91701, 'TEST2', '정비완료');
INSERT INTO public.charge_item(charge_item_id, property_id, item_name, default_price) VALUES (-91701, -91701, '테스트 조식', 10000);
INSERT INTO pms_private.staff_property_access VALUES ('reservation-test@example.invalid', -91701);
SELECT set_config('request.jwt.claims', '{"sub":"91700000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  payload jsonb := '{"property_id":-91701,"customer_name":"예약 검증 고객","check_in":"2099-01-01","check_out":"2099-01-03","external_reference":"TEST-EXTERNAL","rooms":[{"room_type_id":-91701,"room_id":-91701,"rate_amount":160000}],"charges":[{"charge_item_id":-91701,"quantity":2,"unit_price":10000,"service_date":"2099-01-02"}]}';
  result jsonb;
  again jsonb;
  rejected boolean;
BEGIN
  result := public.pms_create_reservation('91700000-0000-4000-8000-000000000002', payload);
  IF result->>'reference' IS NULL THEN RAISE EXCEPTION 'Internal reference missing'; END IF;
  IF (SELECT count(*) FROM public.reservation_room WHERE reservation_id = (result->>'reservation_id')::bigint) <> 1 THEN RAISE EXCEPTION 'Room missing'; END IF;
  IF (SELECT count(*) FROM public.reservation_charge WHERE reservation_id = (result->>'reservation_id')::bigint AND (charged_at AT TIME ZONE 'Asia/Seoul')::date = '2099-01-02') <> 1 THEN RAISE EXCEPTION 'Service missing'; END IF;
  IF (SELECT count(*) FROM public.reservation_ref WHERE reservation_id = (result->>'reservation_id')::bigint) <> 2 THEN RAISE EXCEPTION 'References missing'; END IF;
  again := public.pms_create_reservation('91700000-0000-4000-8000-000000000002', payload);
  IF result <> again THEN RAISE EXCEPTION 'Retry created a duplicate'; END IF;
  rejected := false;
  BEGIN PERFORM public.pms_create_reservation('91700000-0000-4000-8000-000000000002', payload || '{"note":"changed"}');
  EXCEPTION WHEN raise_exception THEN rejected := SQLERRM = '이미 사용한 저장 요청번호입니다.'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Changed retry accepted'; END IF;
  rejected := false;
  BEGIN PERFORM public.pms_create_reservation(gen_random_uuid(), payload);
  EXCEPTION WHEN raise_exception THEN rejected := SQLERRM LIKE '선택한 객실에 겹치는 예약%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Double booking accepted'; END IF;
  rejected := false;
  BEGIN PERFORM public.pms_create_reservation(gen_random_uuid(), payload || '{"property_id":-91702}');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Wrong hotel accepted'; END IF;
  IF EXISTS (SELECT 1 FROM public.property WHERE property_id = -91702) THEN RAISE EXCEPTION 'Wrong hotel visible'; END IF;
  rejected := false;
  BEGIN PERFORM public.pms_create_reservation(gen_random_uuid(), payload || '{"customer_name":"ROLLBACK-CUSTOMER","rooms":[{"room_type_id":-91701,"room_id":-91702,"rate_amount":100}],"charges":[{"charge_item_id":-99999,"quantity":1,"unit_price":100,"service_date":"2099-01-02"}]}');
  EXCEPTION WHEN raise_exception THEN rejected := SQLERRM = '이 호텔의 이용 가능한 서비스를 선택하세요.'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid service accepted'; END IF;
  PERFORM public.pms_create_reservation(gen_random_uuid(), payload || '{"rooms":[{"room_type_id":-91701,"room_id":null,"rate_amount":100}],"charges":[]}');
  rejected := false;
  BEGIN PERFORM public.pms_create_reservation(gen_random_uuid(), payload || '{"rooms":[{"room_type_id":-91701,"room_id":null,"rate_amount":100}],"charges":[]}');
  EXCEPTION WHEN raise_exception THEN rejected := SQLERRM = '선택한 숙박 기간에 해당 객실타입의 잔여 객실이 부족합니다.'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Type inventory oversold'; END IF;
  -- Adjacent stays are allowed; checkout is exclusive.
  PERFORM public.pms_create_reservation(gen_random_uuid(), payload || '{"check_in":"2099-01-03","check_out":"2099-01-04","charges":[]}');
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.customer WHERE customer_name = 'ROLLBACK-CUSTOMER') THEN RAISE EXCEPTION 'Failed transaction left a customer'; END IF;
  IF EXISTS (SELECT 1 FROM public.reservation WHERE property_id = -91701 AND customer_id IN (SELECT customer_id FROM public.customer WHERE customer_name = 'ROLLBACK-CUSTOMER')) THEN RAISE EXCEPTION 'Failed transaction left a reservation'; END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"91700000-0000-4000-8000-000000000099","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reservation) THEN RAISE EXCEPTION 'Non-staff can read reservations'; END IF;
  BEGIN
    PERFORM public.pms_create_reservation(gen_random_uuid(), '{"property_id":-91701}');
    RAISE EXCEPTION 'Non-staff can create reservations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.pms_create_reservation(gen_random_uuid(), '{}');
    RAISE EXCEPTION 'Anonymous can create reservations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
