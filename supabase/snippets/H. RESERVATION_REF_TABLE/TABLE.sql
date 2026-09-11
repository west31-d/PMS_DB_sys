create table public.reservation_ref (
    reservation_id bigint not null
        references public.reservation(reservation_id)
        on delete cascade,

    ref_type text not null,

    ref_number text not null,

    primary key (
        reservation_id,
        ref_type,
        ref_number
    )
);

-- 조회 성능용 인덱스
create index idx_reservation_ref_number
on public.reservation_ref(ref_number);
