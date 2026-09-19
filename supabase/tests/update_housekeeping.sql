BEGIN;
UPDATE pms_private.development_access SET enabled = true WHERE singleton;
INSERT INTO public.property(property_id, property_name) VALUES (-91911, '청소상태 검증');
INSERT INTO public.room_type(room_type_id, property_id, room_type_name) VALUES (-91911, -91911, 'TEST');
INSERT INTO public.room(room_id, property_id, room_type_id, room_number, housekeeping_status, is_out_of_order)
VALUES (-91911, -91911, -91911, '1', '정비완료', true);
DO $$ BEGIN
  PERFORM public.pms_update_housekeeping(-91911, '미정비');
  IF (SELECT housekeeping_status FROM public.room WHERE room_id = -91911) <> '미정비' THEN RAISE EXCEPTION 'Update failed'; END IF;
  PERFORM public.pms_update_housekeeping(-91911, '정비완료');
  IF (SELECT housekeeping_status FROM public.room WHERE room_id = -91911) <> '정비완료'
    OR NOT (SELECT is_out_of_order FROM public.room WHERE room_id = -91911) THEN RAISE EXCEPTION 'Unrelated state changed'; END IF;
  BEGIN
    PERFORM public.pms_update_housekeeping(-91911, '재실');
    RAISE EXCEPTION 'Invalid state accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '정비완료 또는 미정비를 선택하세요.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.pms_update_housekeeping(-99999999, '미정비');
    RAISE EXCEPTION 'Missing room accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
