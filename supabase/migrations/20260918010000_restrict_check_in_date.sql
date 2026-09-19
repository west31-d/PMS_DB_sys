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
  IF v_booking.check_in <> (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION '체크인 날짜가 오늘인 객실만 입실 처리할 수 있습니다.';
  END IF;
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

