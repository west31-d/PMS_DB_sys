CREATE FUNCTION public.pms_complete_cleaning(p_property_id bigint, p_business_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.pms_has_property_access(p_property_id) THEN
    RAISE EXCEPTION '이 호텔의 청소 완료 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_business_date IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION '오늘 청소표에서만 청소 완료를 처리할 수 있습니다.';
  END IF;
  PERFORM 1 FROM public.property WHERE property_id = p_property_id FOR UPDATE;
  UPDATE public.room SET housekeeping_status = '정비완료'
  WHERE property_id = p_property_id AND housekeeping_status = '미정비';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_complete_cleaning(bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_complete_cleaning(bigint, date) TO anon, authenticated;
