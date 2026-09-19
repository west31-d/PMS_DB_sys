CREATE TABLE public.housekeeping_notes (
  property_id bigint NOT NULL REFERENCES public.property(property_id) ON DELETE CASCADE,
  business_date date NOT NULL,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  defects text NOT NULL DEFAULT '' CHECK (length(defects) <= 10000),
  PRIMARY KEY (property_id, business_date)
);
ALTER TABLE public.housekeeping_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.housekeeping_notes TO anon, authenticated;
CREATE POLICY pms_staff_read ON public.housekeeping_notes FOR SELECT TO anon, authenticated
USING (public.pms_has_property_access(property_id));
CREATE FUNCTION public.pms_save_housekeeping_notes(p_property_id bigint, p_business_date date, p_notes text, p_defects text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pms_has_property_access(p_property_id) THEN
    RAISE EXCEPTION '이 호텔의 청소표 메모 변경 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.housekeeping_notes(property_id, business_date, notes, defects)
  VALUES (p_property_id, p_business_date, p_notes, p_defects)
  ON CONFLICT (property_id, business_date) DO UPDATE SET notes = EXCLUDED.notes, defects = EXCLUDED.defects;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_save_housekeeping_notes(bigint, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_save_housekeeping_notes(bigint, date, text, text) TO anon, authenticated;
