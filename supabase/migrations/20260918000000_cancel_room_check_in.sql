-- Undo a room check-in only on the booking's arrival date (hotel time).
CREATE FUNCTION public.pms_cancel_check_in_room(p_reservation_room_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_property bigint;
  v_reservation bigint;
  v_booking public.reservation%ROWTYPE;
  v_line public.reservation_room%ROWTYPE;
BEGIN
  SELECT r.property_id, r.reservation_id INTO v_property, v_reservation
  FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
  WHERE rr.reservation_room_id = p_reservation_room_id;
  IF v_property IS NULL OR NOT public.pms_has_property_access(v_property) THEN
    RAISE EXCEPTION '이 객실의 입실 취소 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  -- Same lock order as check-in and reservation creation.
  PERFORM 1 FROM public.property WHERE property_id = v_property FOR UPDATE;
  SELECT * INTO v_booking FROM public.reservation WHERE reservation_id = v_reservation FOR UPDATE;
  SELECT * INTO v_line FROM public.reservation_room WHERE reservation_room_id = p_reservation_room_id FOR UPDATE;
  IF v_booking.check_in <> (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION '체크인 날짜가 오늘인 객실만 입실을 취소할 수 있습니다.';
  END IF;
  IF v_booking.status NOT IN ('예약', '재실') OR v_line.stay_status NOT IN ('예약', '재실') OR v_line.room_id IS NULL THEN
    RAISE EXCEPTION '입실 취소가 가능한 객실이 아닙니다.';
  END IF;
  -- Repeated requests are harmless. Cleaning state and room assignment are retained.
  IF v_line.stay_status = '예약' THEN RETURN; END IF;
  UPDATE public.reservation_room SET stay_status = '예약' WHERE reservation_room_id = p_reservation_room_id;
  UPDATE public.reservation SET status = CASE WHEN EXISTS (
    SELECT 1 FROM public.reservation_room
    WHERE reservation_id = v_reservation AND stay_status = '재실'
  ) THEN '재실' ELSE '예약' END WHERE reservation_id = v_reservation;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_cancel_check_in_room(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_cancel_check_in_room(bigint) TO anon, authenticated;
