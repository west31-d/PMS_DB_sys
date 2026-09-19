BEGIN;
UPDATE pms_private.development_access SET enabled = true WHERE singleton;
INSERT INTO public.property(property_id, property_name) VALUES (-91801, '입실 취소 검증');
INSERT INTO public.room_type(room_type_id, property_id, room_type_name) VALUES (-91801, -91801, 'TEST');
INSERT INTO public.room(room_id, property_id, room_type_id, room_number, housekeeping_status)
VALUES (-91801, -91801, -91801, '1', '정비완료'), (-91802, -91801, -91801, '2', '미정비');
INSERT INTO public.customer(customer_id, customer_name) VALUES (-91801, 'TEST');
INSERT INTO public.reservation(reservation_id, property_id, customer_id, check_in, check_out, status)
VALUES (-91801, -91801, -91801, (now() AT TIME ZONE 'Asia/Seoul')::date, (now() AT TIME ZONE 'Asia/Seoul')::date + 1, '재실');
INSERT INTO public.reservation_room(reservation_room_id, reservation_id, room_type_id, room_id, stay_status)
VALUES (-91801, -91801, -91801, -91801, '재실'), (-91802, -91801, -91801, -91802, '재실');
DO $$ BEGIN
  PERFORM public.pms_cancel_check_in_room(-91801);
  IF (SELECT status FROM public.reservation WHERE reservation_id = -91801) <> '재실'
    OR (SELECT stay_status FROM public.reservation_room WHERE reservation_room_id = -91801) <> '예약'
  THEN RAISE EXCEPTION 'Partial reversal failed'; END IF;
  PERFORM public.pms_cancel_check_in_room(-91802);
  PERFORM public.pms_cancel_check_in_room(-91802);
  IF (SELECT status FROM public.reservation WHERE reservation_id = -91801) <> '예약'
    OR (SELECT housekeeping_status FROM public.room WHERE room_id = -91802) <> '미정비'
    OR (SELECT room_id FROM public.reservation_room WHERE reservation_room_id = -91802) <> -91802
  THEN RAISE EXCEPTION 'Final reversal changed unrelated data'; END IF;
  UPDATE public.reservation SET status = '재실', check_in = check_in - 1 WHERE reservation_id = -91801;
  UPDATE public.reservation_room SET stay_status = '재실' WHERE reservation_room_id = -91801;
  BEGIN
    PERFORM public.pms_cancel_check_in_room(-91801);
    RAISE EXCEPTION 'Past arrival accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '체크인 날짜가 오늘인 객실만 입실을 취소할 수 있습니다.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.pms_cancel_check_in_room(-99999999);
    RAISE EXCEPTION 'Missing room accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
