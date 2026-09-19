BEGIN;
UPDATE pms_private.development_access SET enabled = true WHERE singleton;
INSERT INTO public.property(property_id, property_name) VALUES (-91901, '퇴실 검증');
INSERT INTO public.room_type(room_type_id, property_id, room_type_name) VALUES (-91901, -91901, 'TEST');
INSERT INTO public.room(room_id, property_id, room_type_id, room_number, housekeeping_status)
VALUES (-91901, -91901, -91901, '1', '정비완료'), (-91902, -91901, -91901, '2', '정비완료');
INSERT INTO public.customer(customer_id, customer_name) VALUES (-91901, 'TEST');
INSERT INTO public.reservation(reservation_id, property_id, customer_id, check_in, check_out, status)
VALUES (-91901, -91901, -91901, current_date - 1, current_date + 1, '재실');
INSERT INTO public.reservation_room(reservation_room_id, reservation_id, room_type_id, room_id, stay_status)
VALUES (-91901, -91901, -91901, -91901, '재실'), (-91902, -91901, -91901, -91902, '예약');
DO $$ BEGIN
  BEGIN
    PERFORM public.pms_check_out_rooms(-91901, ARRAY[-91901, -91902]::bigint[]);
    RAISE EXCEPTION 'Unoccupied room accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '재실 중인 객실만 퇴실할 수 있습니다.' THEN RAISE; END IF;
  END;
  IF (SELECT stay_status FROM public.reservation_room WHERE reservation_room_id = -91901) <> '재실' THEN RAISE EXCEPTION 'Atomic rollback failed'; END IF;
  UPDATE public.reservation_room SET stay_status = '재실' WHERE reservation_room_id = -91902;
  PERFORM public.pms_check_out_rooms(-91901, ARRAY[-91901]::bigint[]);
  IF (SELECT status FROM public.reservation WHERE reservation_id = -91901) <> '재실'
    OR (SELECT housekeeping_status FROM public.room WHERE room_id = -91901) <> '미정비'
  THEN RAISE EXCEPTION 'Partial checkout failed'; END IF;
  PERFORM public.pms_check_out_rooms(-91901, ARRAY[-91902]::bigint[]);
  UPDATE public.room SET housekeeping_status = '정비완료' WHERE room_id = -91902;
  PERFORM public.pms_check_out_rooms(-91901, ARRAY[-91902]::bigint[]);
  IF (SELECT status FROM public.reservation WHERE reservation_id = -91901) <> '퇴실'
    OR (SELECT housekeeping_status FROM public.room WHERE room_id = -91902) <> '정비완료'
    OR (SELECT check_out FROM public.reservation WHERE reservation_id = -91901) <> current_date + 1
  THEN RAISE EXCEPTION 'Final or repeated checkout failed'; END IF;
  BEGIN
    PERFORM public.pms_check_out_rooms(-99999999, ARRAY[-91901]::bigint[]);
    RAISE EXCEPTION 'Missing reservation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
