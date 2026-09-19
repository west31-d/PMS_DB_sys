CREATE FUNCTION public.pms_update_housekeeping(p_room_id bigint, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_property bigint;
BEGIN
  SELECT property_id INTO v_property FROM public.room WHERE room_id = p_room_id;
  IF v_property IS NULL OR NOT public.pms_has_property_access(v_property) THEN
    RAISE EXCEPTION '이 객실의 정비 상태 변경 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('정비완료', '미정비') THEN
    RAISE EXCEPTION '정비완료 또는 미정비를 선택하세요.';
  END IF;
  PERFORM 1 FROM public.property WHERE property_id = v_property FOR UPDATE;
  UPDATE public.room SET housekeeping_status = p_status WHERE room_id = p_room_id AND property_id = v_property;
END;
$$;
REVOKE ALL ON FUNCTION public.pms_update_housekeeping(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pms_update_housekeeping(bigint, text) TO anon, authenticated;
