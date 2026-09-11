-- ROOM_TYPE INITIAL DATA

INSERT INTO public.room_type (
    room_type_id,
    property_id,
    room_type_name
)
VALUES
    (1, 1, 'STT'),
    (2, 1, 'STD'),
    (3, 1, 'DTL');

-- 원본 dump의 sequence 상태 유지: 다음 ID = 5
SELECT pg_catalog.setval(
    'public.room_type_room_type_id_seq',
    4,
    true
);
