BEGIN;
UPDATE pms_private.development_access SET enabled = true WHERE singleton;
INSERT INTO public.property(property_id, property_name) VALUES (-91921, '메모 검증');
DO $$ BEGIN
  PERFORM public.pms_save_housekeeping_notes(-91921, DATE '2026-09-19', '첫 메모', '고장');
  PERFORM public.pms_save_housekeeping_notes(-91921, DATE '2026-09-19', '수정 메모', '수정 고장');
  PERFORM public.pms_save_housekeeping_notes(-91921, DATE '2026-09-20', '다음날', '');
  IF (SELECT count(*) FROM public.housekeeping_notes WHERE property_id=-91921) <> 2
    OR (SELECT notes FROM public.housekeeping_notes WHERE property_id=-91921 AND business_date=DATE '2026-09-19') <> '수정 메모'
  THEN RAISE EXCEPTION 'Notes save failed'; END IF;
END $$;
ROLLBACK;
