-- Room-level checkout; reservation-level amounts and planned dates remain intact.
CREATE FUNCTION public.pms_check_out_rooms(p_reservation_id bigint, p_room_ids bigint[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_property bigint;
  v_booking public.reservation%ROWTYPE;
  v_line public.reservation_room%ROWTYPE;
BEGIN
  SELECT property_id INTO v_property FROM public.reservation WHERE reservation_id = p_reservation_id;
  IF v_property IS NULL OR NOT public.pms_has_property_access(v_property) THEN
    RAISE EXCEPTION '이 예약의 퇴실 처리 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_room_ids IS NULL OR cardinality(p_room_ids) NOT BETWEEN 1 AND 100
    OR EXISTS (SELECT 1 FROM unnest(p_room_ids) x WHERE x IS NULL)
    OR (SELECT count(DISTINCT x) FROM unnest(p_room_ids) x) <> cardinality(p_room_ids) THEN
    RAISE EXCEPTION '퇴실할 객실을 선택하세요.';
  END IF;
  PERFORM 1 FROM public.property WHERE property_id = v_property FOR UPDATE;
  SELECT * INTO v_booking FROM public.reservation WHERE reservation_id = p_reservation_id FOR UPDATE;
  IF v_booking.status NOT IN ('예약', '재실', '퇴실') THEN RAISE EXCEPTION '퇴실 가능한 예약이 아닙니다.'; END IF;
  IF (SELECT count(*) FROM public.reservation_room WHERE reservation_id = p_reservation_id AND reservation_room_id = ANY(p_room_ids)) <> cardinality(p_room_ids) THEN
    RAISE EXCEPTION '선택한 객실이 이 예약에 속하지 않습니다.';
  END IF;
  FOR v_line IN SELECT * FROM public.reservation_room WHERE reservation_id = p_reservation_id AND reservation_room_id = ANY(p_room_ids) ORDER BY reservation_room_id FOR UPDATE LOOP
    IF v_line.stay_status = '퇴실' THEN CONTINUE; END IF;
    IF v_booking.status = '퇴실' OR v_line.stay_status <> '재실' OR v_line.room_id IS NULL THEN
      RAISE EXCEPTION '재실 중인 객실만 퇴실할 수 있습니다.';
    END IF;
    UPDATE public.reservation_room SET stay_status = '퇴실' WHERE reservation_room_id = v_line.reservation_room_id;
    UPDATE public.room SET housekeeping_status = '미정비' WHERE room_id = v_line.room_id AND property_id = v_property;
  END LOOP;
  UPDATE public.reservation SET status = CASE
    WHEN EXISTS (SELECT 1 FROM public.reservation_room WHERE reservation_id = p_reservation_id AND stay_status = '재실') THEN '재실'
    WHEN EXISTS (SELECT 1 FROM public.reservation_room WHERE reservation_id = p_reservation_id AND stay_status = '예약') THEN '예약'
    ELSE '퇴실' END
  WHERE reservation_id = p_reservation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_check_out_rooms(bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_check_out_rooms(bigint, bigint[]) TO anon, authenticated;
