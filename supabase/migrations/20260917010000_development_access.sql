-- Disabled by default. Enable explicitly on the development project only.
CREATE TABLE pms_private.development_access (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO pms_private.development_access(singleton, enabled) VALUES (true, false);

CREATE FUNCTION public.pms_development_mode()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT enabled FROM pms_private.development_access WHERE singleton), false);
$$;
REVOKE ALL ON FUNCTION public.pms_development_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_development_mode() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pms_has_property_access(p_property_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.pms_development_mode() OR EXISTS (
    SELECT 1 FROM pms_private.staff_property_access s
    JOIN auth.users u ON lower(u.email) = s.email
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND (p_property_id IS NULL OR s.property_id = p_property_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.pms_has_property_access(bigint) TO anon;
ALTER TABLE pms_private.reservation_requests ALTER COLUMN user_id DROP NOT NULL;
GRANT SELECT ON public.property, public.room_type, public.room, public.rate_type,
  public.customer, public.partner, public.reservation, public.reservation_room,
  public.reservation_ref, public.charge_item, public.reservation_charge, public.payment TO anon;

ALTER POLICY pms_staff_read ON public.property TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.room_type TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.room TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.rate_type TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.charge_item TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.reservation TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.customer TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.partner TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.reservation_room TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.reservation_ref TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.reservation_charge TO anon, authenticated;
ALTER POLICY pms_staff_read ON public.payment TO anon, authenticated;
-- Development mode also allows existing, not-yet-booked customers to be selected.
ALTER POLICY pms_staff_read ON public.customer USING (
  public.pms_development_mode() OR EXISTS (SELECT 1 FROM public.reservation r WHERE r.customer_id = customer.customer_id)
);

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
          WHERE rr.room_id = v_room AND r.status IN ('예약', '재실') AND r.check_in < v_check_out AND r.check_out > v_check_in) THEN
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
        WHERE rr.room_type_id = q.type_id AND r.property_id = v_property AND r.status IN ('예약', '재실') AND r.check_in <= b.day AND r.check_out > b.day)
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
