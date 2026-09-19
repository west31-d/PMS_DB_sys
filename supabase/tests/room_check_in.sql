BEGIN;
DO $$
DECLARE v_room public.room%ROWTYPE; v_customer bigint; v_offset integer;
BEGIN
  SELECT * INTO v_room FROM public.room rm WHERE NOT rm.is_out_of_order
    AND rm.housekeeping_status = '정비완료'
    AND NOT EXISTS (SELECT 1 FROM public.reservation_room rr JOIN public.reservation r USING (reservation_id)
      WHERE rr.room_id = rm.room_id AND rr.stay_status = '재실' AND r.status = '재실') LIMIT 1;
  SELECT customer_id INTO v_customer FROM public.customer LIMIT 1;
  IF v_room.room_id IS NULL OR v_customer IS NULL THEN RAISE EXCEPTION 'Test fixture unavailable'; END IF;
  INSERT INTO public.reservation(reservation_id, property_id, customer_id, check_in, check_out, status)
    VALUES (-9172001, v_room.property_id, v_customer, (now() AT TIME ZONE 'Asia/Seoul')::date, (now() AT TIME ZONE 'Asia/Seoul')::date + 1, '예약');
  INSERT INTO public.reservation_room(reservation_room_id, reservation_id, room_type_id, room_id)
    VALUES (-9172001, -9172001, v_room.room_type_id, v_room.room_id),
           (-9172002, -9172001, v_room.room_type_id, NULL);
  FOREACH v_offset IN ARRAY ARRAY[-1, 1] LOOP
    UPDATE public.reservation SET check_in = (now() AT TIME ZONE 'Asia/Seoul')::date + v_offset,
      check_out = (now() AT TIME ZONE 'Asia/Seoul')::date + v_offset + 1 WHERE reservation_id = -9172001;
    BEGIN
      PERFORM public.pms_check_in_room(-9172001);
      RAISE EXCEPTION 'Non-today arrival accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> '체크인 날짜가 오늘인 객실만 입실 처리할 수 있습니다.' THEN RAISE; END IF;
    END;
  END LOOP;
  UPDATE public.reservation SET check_in = (now() AT TIME ZONE 'Asia/Seoul')::date,
    check_out = (now() AT TIME ZONE 'Asia/Seoul')::date + 1 WHERE reservation_id = -9172001;
  PERFORM public.pms_check_in_room(-9172001);
  PERFORM public.pms_check_in_room(-9172001);
  IF (SELECT stay_status FROM public.reservation_room WHERE reservation_room_id = -9172001) <> '재실'
    OR (SELECT stay_status FROM public.reservation_room WHERE reservation_room_id = -9172002) <> '예약'
    OR (SELECT status FROM public.reservation WHERE reservation_id = -9172001) <> '재실'
    OR (SELECT housekeeping_status FROM public.room WHERE room_id = v_room.room_id) <> '정비완료'
  THEN RAISE EXCEPTION 'Room check-in state mismatch'; END IF;
  -- Cleaning can change during a stay without changing occupancy.
  UPDATE public.room SET housekeeping_status = '미정비' WHERE room_id = v_room.room_id;
  PERFORM public.pms_check_in_room(-9172001);
  IF (SELECT housekeeping_status FROM public.room WHERE room_id = v_room.room_id) <> '미정비'
  THEN RAISE EXCEPTION 'Idempotent check-in changed cleaning state'; END IF;
  BEGIN
    PERFORM public.pms_check_in_room(-9172002);
    RAISE EXCEPTION 'Unassigned room accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '호수를 먼저 배정하세요.' THEN RAISE; END IF;
  END;
  UPDATE public.reservation_room SET stay_status = '퇴실' WHERE reservation_room_id = -9172001;
  UPDATE public.reservation_room SET room_id = v_room.room_id WHERE reservation_room_id = -9172002;
  BEGIN
    PERFORM public.pms_check_in_room(-9172002);
    RAISE EXCEPTION 'Dirty room accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '정비완료 객실만 입실할 수 있습니다.' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
