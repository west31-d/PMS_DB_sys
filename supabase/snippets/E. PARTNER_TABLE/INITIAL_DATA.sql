-- PARTNER INITIAL DATA

INSERT INTO public.partner (
    partner_id,
    partner_name,
    partner_type
)
VALUES
    (1, '히스', 'TBA'),
    (2, '비에스', 'TBA'),
    (3, '한진', 'TBA'),
    (4, '아고다', 'OTA'),
    (5, '트립닷컴', 'OTA'),
    (6, 'DOTW', 'OTA'),
    (7, '익스피디아', 'OTA');

-- 원본 dump의 sequence 상태 유지: 다음 ID = 29
SELECT pg_catalog.setval(
    'public.partner_partner_id_seq',
    28,
    true
);
