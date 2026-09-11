-- PROPERTY INITIAL DATA

INSERT INTO public.property (
    property_id,
    property_name
)
VALUES
    (1, '쓰리세븐호텔');

SELECT pg_catalog.setval(
    'public.property_property_id_seq',
    1,
    true
);
