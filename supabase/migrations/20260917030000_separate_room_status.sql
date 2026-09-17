-- Cleaning state belongs to room; occupancy belongs to reservation_room.
-- Do not silently release an occupied room whose stay record is missing.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.room rm WHERE rm.housekeeping_status = '재실'
      AND NOT EXISTS (
        SELECT 1 FROM public.reservation_room rr
        JOIN public.reservation r USING (reservation_id)
        WHERE rr.room_id = rm.room_id AND r.property_id = rm.property_id
          AND rr.stay_status = '재실' AND r.status IN ('예약', '재실')
      )
  ) THEN
    RAISE EXCEPTION '재실 객실에 연결된 숙박 기록이 없습니다. 객실별 입실 기록을 확인한 후 다시 적용하세요.';
  END IF;
END $$;
ALTER TABLE public.reservation ALTER COLUMN status SET DEFAULT '예약';
ALTER TABLE public.room DROP CONSTRAINT chk_housekeeping_status;
-- Legacy occupied rooms have no reliable cleaning record: require inspection.
UPDATE public.room SET housekeeping_status = CASE housekeeping_status
  WHEN '공실' THEN '정비완료' WHEN '재실' THEN '미정비' ELSE housekeeping_status END;
ALTER TABLE public.room ALTER COLUMN housekeeping_status SET DEFAULT '정비완료';
ALTER TABLE public.room ADD CONSTRAINT chk_housekeeping_status
  CHECK (housekeeping_status IN ('정비완료', '미정비'));
COMMENT ON COLUMN public.room.housekeeping_status IS '청소·정비 상태: 정비완료 / 미정비. 점유 상태는 reservation_room.stay_status로 판단';
COMMENT ON COLUMN public.reservation.status IS '예약 전체 상태: 예약 / 재실 / 퇴실 / 취소. 일부 객실만 입실해도 재실';
COMMENT ON COLUMN public.reservation_room.stay_status IS '객실별 숙박 상태: 예약 / 재실 / 퇴실 / 취소';

CREATE OR REPLACE FUNCTION public.pms_check_in_room(p_reservation_room_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_property bigint;
  v_reservation bigint;
  v_booking public.reservation%ROWTYPE;
  v_line public.reservation_room%ROWTYPE;
  v_room public.room%ROWTYPE;
BEGIN
  SELECT r.property_id, r.reservation_id INTO v_property, v_reservation
  FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
  WHERE rr.reservation_room_id = p_reservation_room_id;
  IF v_property IS NULL OR NOT public.pms_has_property_access(v_property) THEN
    RAISE EXCEPTION '이 객실의 입실 처리 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  -- Match reservation creation's property lock to serialize room operations.
  PERFORM 1 FROM public.property WHERE property_id = v_property FOR UPDATE;
  SELECT * INTO v_booking FROM public.reservation WHERE reservation_id = v_reservation FOR UPDATE;
  SELECT * INTO v_line FROM public.reservation_room WHERE reservation_room_id = p_reservation_room_id FOR UPDATE;
  IF v_booking.status NOT IN ('예약', '재실') OR v_line.stay_status NOT IN ('예약', '재실') THEN
    RAISE EXCEPTION '취소 또는 퇴실된 객실은 입실할 수 없습니다.';
  END IF;
  IF v_line.room_id IS NULL THEN RAISE EXCEPTION '호수를 먼저 배정하세요.'; END IF;
  SELECT * INTO v_room FROM public.room WHERE room_id = v_line.room_id FOR UPDATE;
  IF v_room.property_id <> v_property OR v_room.room_type_id <> v_line.room_type_id OR v_room.is_out_of_order THEN
    RAISE EXCEPTION '배정 객실 정보를 확인하세요. 고장 객실은 입실할 수 없습니다.';
  END IF;
  IF v_line.stay_status = '재실' THEN RETURN; END IF;
  IF v_room.housekeeping_status <> '정비완료' THEN
    RAISE EXCEPTION '정비완료 객실만 입실할 수 있습니다.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
    WHERE rr.room_id = v_line.room_id AND rr.reservation_room_id <> p_reservation_room_id
      AND rr.stay_status = '재실' AND r.status IN ('예약', '재실')
  ) THEN RAISE EXCEPTION '이미 재실 중인 객실입니다.'; END IF;
  UPDATE public.reservation_room SET stay_status = '재실' WHERE reservation_room_id = p_reservation_room_id;
  UPDATE public.reservation SET status = '재실' WHERE reservation_id = v_reservation;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_check_in_room(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_check_in_room(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pms_create_reservation(p_request_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_property bigint := (p_payload->>'property_id')::bigint;
  v_customer bigint := (p_payload->>'customer_id')::bigint;
  v_partner bigint := (p_payload->>'booking_partner_id')::bigint;
  v_check_in date := (p_payload->>'check_in')::date;
  v_check_out date := (p_payload->>'check_out')::date;
  v_id bigint;
  v_line jsonb;
  v_room bigint;
  v_type bigint;
  v_amount numeric;
  v_existing pms_private.reservation_requests%ROWTYPE;
BEGIN
  IF NOT public.pms_has_property_access(v_property) OR v_property IS NULL THEN
    RAISE EXCEPTION '이 호텔의 예약 저장 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION '저장 요청번호가 필요합니다.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  SELECT * INTO v_existing FROM pms_private.reservation_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM auth.uid() OR v_existing.payload <> p_payload THEN
      RAISE EXCEPTION '이미 사용한 저장 요청번호입니다.';
    END IF;
    v_id := v_existing.reservation_id;
  ELSE
    IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_out <= v_check_in THEN
      RAISE EXCEPTION '퇴실일은 입실일 이후여야 합니다.';
    END IF;
    IF jsonb_typeof(p_payload->'rooms') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '객실을 입력하세요.'; END IF;
    IF jsonb_array_length(p_payload->'rooms') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION '객실은 1~100실 입력하세요.'; END IF;
    IF jsonb_typeof(p_payload->'charges') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '서비스 입력 형식이 올바르지 않습니다.'; END IF;
    IF jsonb_array_length(p_payload->'charges') > 100 THEN RAISE EXCEPTION '서비스는 최대 100건까지 입력하세요.'; END IF;
    -- Serialize reservations for this property, including unassigned room inventory.
    PERFORM 1 FROM public.property WHERE property_id = v_property FOR UPDATE;
    IF v_partner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.partner WHERE partner_id = v_partner) THEN
      RAISE EXCEPTION '거래처를 다시 선택하세요.';
    END IF;
    IF v_customer IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.customer c WHERE c.customer_id = v_customer AND (public.pms_development_mode() OR EXISTS (SELECT 1 FROM public.reservation r WHERE r.customer_id = c.customer_id AND public.pms_has_property_access(r.property_id)))) THEN
        RAISE EXCEPTION '선택한 고객을 조회할 권한이 없습니다.';
      END IF;
    ELSE
      IF nullif(btrim(p_payload->>'customer_name'), '') IS NULL THEN RAISE EXCEPTION '고객명을 입력하세요.'; END IF;
      INSERT INTO public.customer(customer_name) VALUES (btrim(p_payload->>'customer_name')) RETURNING customer_id INTO v_customer;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'rooms') x
      WHERE x->>'room_id' IS NOT NULL GROUP BY x->>'room_id' HAVING count(*) > 1
    ) THEN RAISE EXCEPTION '같은 객실을 중복 배정할 수 없습니다.'; END IF;

    FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'rooms') LOOP
      v_type := (v_line->>'room_type_id')::bigint;
      v_room := (v_line->>'room_id')::bigint;
      v_amount := (v_line->>'rate_amount')::numeric;
      IF NOT EXISTS (SELECT 1 FROM public.room_type WHERE room_type_id = v_type AND property_id = v_property) THEN
        RAISE EXCEPTION '이 호텔의 객실타입을 선택하세요.';
      END IF;
      IF v_amount IS NULL OR v_amount < 0 OR v_amount > 9999999999.99 OR v_amount <> round(v_amount, 2) THEN
        RAISE EXCEPTION '객실 요금이 올바르지 않습니다.';
      END IF;
      IF v_room IS NOT NULL THEN
        PERFORM 1 FROM public.room WHERE room_id = v_room AND property_id = v_property AND room_type_id = v_type AND NOT is_out_of_order FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION '배정 가능한 객실이 아닙니다.'; END IF;
        IF EXISTS (SELECT 1 FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
          WHERE rr.room_id = v_room AND r.status IN ('예약', '재실') AND rr.stay_status IN ('예약', '재실') AND r.check_in < v_check_out AND r.check_out > v_check_in) THEN
          RAISE EXCEPTION '선택한 객실에 겹치는 예약이 있습니다. 객실을 다시 선택하세요.';
        END IF;
      END IF;
    END LOOP;
    -- Occupancy can only increase at check-in boundaries; test each boundary.
    IF EXISTS (
      WITH requested AS (
        SELECT (x->>'room_type_id')::bigint AS type_id, count(*) AS qty
        FROM jsonb_array_elements(p_payload->'rooms') x GROUP BY 1
      ), boundaries AS (
        SELECT v_check_in AS day UNION SELECT check_in FROM public.reservation
        WHERE property_id = v_property AND status IN ('예약', '재실') AND check_in >= v_check_in AND check_in < v_check_out
      )
      SELECT 1 FROM requested q CROSS JOIN boundaries b
      WHERE q.qty + (SELECT count(*) FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
        WHERE rr.room_type_id = q.type_id AND r.property_id = v_property AND r.status IN ('예약', '재실') AND rr.stay_status IN ('예약', '재실') AND r.check_in <= b.day AND r.check_out > b.day)
        > (SELECT count(*) FROM public.room WHERE property_id = v_property AND room_type_id = q.type_id AND NOT is_out_of_order)
    ) THEN RAISE EXCEPTION '선택한 숙박 기간에 해당 객실타입의 잔여 객실이 부족합니다.'; END IF;

    INSERT INTO public.reservation(property_id, customer_id, booking_partner_id, check_in, check_out, status, note)
    VALUES (v_property, v_customer, v_partner, v_check_in, v_check_out, '예약', nullif(btrim(p_payload->>'note'), ''))
    RETURNING reservation_id INTO v_id;
    INSERT INTO public.reservation_room(reservation_id, room_type_id, room_id, rate_amount)
    SELECT v_id, (x->>'room_type_id')::bigint, (x->>'room_id')::bigint, (x->>'rate_amount')::numeric
    FROM jsonb_array_elements(p_payload->'rooms') x;
    IF nullif(btrim(p_payload->>'external_reference'), '') IS NOT NULL THEN
      INSERT INTO public.reservation_ref(reservation_id, ref_type, ref_number) VALUES (v_id, 'EXTERNAL', btrim(p_payload->>'external_reference'));
    END IF;
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'charges') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.charge_item WHERE charge_item_id = (v_line->>'charge_item_id')::bigint AND property_id = v_property AND is_active) THEN
        RAISE EXCEPTION '이 호텔의 이용 가능한 서비스를 선택하세요.';
      END IF;
      IF (v_line->>'quantity')::numeric IS NULL OR (v_line->>'quantity')::numeric <> trunc((v_line->>'quantity')::numeric)
        OR (v_line->>'quantity')::numeric <= 0 OR (v_line->>'unit_price')::numeric IS NULL
        OR (v_line->>'unit_price')::numeric < 0 OR (v_line->>'unit_price')::numeric > 9999999999.99
        OR (v_line->>'unit_price')::numeric <> round((v_line->>'unit_price')::numeric, 2) THEN
        RAISE EXCEPTION '서비스 수량 또는 단가가 올바르지 않습니다.';
      END IF;
      IF (v_line->>'service_date')::date IS NULL OR (v_line->>'service_date')::date < v_check_in OR (v_line->>'service_date')::date > v_check_out THEN
        RAISE EXCEPTION '서비스 이용일은 숙박 기간 내에서 선택하세요.';
      END IF;
      INSERT INTO public.reservation_charge(reservation_id, charge_item_id, quantity, unit_price, charged_at)
      VALUES (v_id, (v_line->>'charge_item_id')::bigint, (v_line->>'quantity')::integer, (v_line->>'unit_price')::numeric,
        (v_line->>'service_date')::date::timestamp AT TIME ZONE 'Asia/Seoul');
    END LOOP;
    INSERT INTO pms_private.reservation_requests VALUES (p_request_id, auth.uid(), p_payload, v_id);
  END IF;
  RETURN jsonb_build_object('reservation_id', v_id,
    'reference', (SELECT ref_number FROM public.reservation_ref WHERE reservation_id = v_id AND ref_type = 'INTERNAL'));
END;
$$;
REVOKE ALL ON FUNCTION public.pms_create_reservation(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pms_create_reservation(uuid, jsonb) TO anon, authenticated;
