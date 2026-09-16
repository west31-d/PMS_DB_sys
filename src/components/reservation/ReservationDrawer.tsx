import { useEffect, useRef } from "react";
import { X, BedDouble } from "lucide-react";
import type { Dataset, ReservationRow } from "../../lib/types";
import { money } from "../../lib/domain";
import { StatusBadge } from "../ui";
export function ReservationDrawer({
  row,
  data,
  onClose,
}: {
  row: ReservationRow | null;
  data: Dataset;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (row && !el?.open) el?.showModal();
    if (!row && el?.open) el.close();
  }, [row]);
  return (
    <dialog
      aria-label="예약 상세"
      className="reservation-drawer"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {row && (
        <div className="drawer-inner">
          <header>
            <div>
              <span className="eyebrow">RESERVATION</span>
              <h2>예약 상세</h2>
            </div>
            <button
              className="icon-button"
              aria-label="예약 상세 닫기"
              onClick={onClose}
            >
              <X size={21} />
            </button>
          </header>
          <div className="drawer-body">
            <div className="detail-heading">
              <h2>{row.customer}</h2>
              <StatusBadge status={row.status} />
            </div>
            <p className="muted">{row.reference}</p>
            <dl className="detail-grid">
              <dt>입실일</dt>
              <dd>{row.check_in}</dd>
              <dt>퇴실일</dt>
              <dd>{row.check_out}</dd>
              <dt>거래처</dt>
              <dd>{row.partner}</dd>
              <dt>예약번호</dt>
              <dd>
                {data.refs
                  .filter((x) => x.reservation_id === row.reservation_id)
                  .map((x) => (
                    <div key={x.ref_type + x.ref_number}>
                      {x.ref_type}: {x.ref_number}
                    </div>
                  ))}
              </dd>
            </dl>
            <h3>
              <BedDouble size={17} /> 객실 · 요금
            </h3>
            {data.reservationRooms
              .filter((x) => x.reservation_id === row.reservation_id)
              .map((x) => (
                <div className="detail-card" key={x.reservation_room_id}>
                  <strong>
                    {data.rooms.find((r) => r.room_id === x.room_id)
                      ?.room_number ?? "미배정"}{" "}
                    <span className="muted">
                      {
                        data.roomTypes.find(
                          (t) => t.room_type_id === x.room_type_id,
                        )?.room_type_name
                      }
                    </span>
                  </strong>
                  <dl className="detail-grid">
                    <dt>요금 타입</dt>
                    <dd>연결 준비 중</dd>
                    <dt>객실 요금</dt>
                    <dd>{money(Number(x.rate_amount))}</dd>
                  </dl>
                </div>
              ))}
            <h3>부대 이용내역 · Folio</h3>
            {data.charges
              .filter((x) => x.reservation_id === row.reservation_id)
              .map((x) => (
                <div className="detail-line" key={x.reservation_charge_id}>
                  <span>
                    {data.chargeItems.find(
                      (c) => c.charge_item_id === x.charge_item_id,
                    )?.item_name ?? "부대항목"}{" "}
                    × {x.quantity}
                  </span>
                  <strong>{money(x.quantity * Number(x.unit_price))}</strong>
                </div>
              ))}
            {!data.charges.some(
              (x) => x.reservation_id === row.reservation_id,
            ) && <p className="muted">등록된 이용내역이 없습니다.</p>}
            <h3>결제 · Payment</h3>
            {data.payments
              .filter((x) => x.reservation_id === row.reservation_id)
              .map((x) => (
                <div className="detail-line" key={x.payment_id}>
                  <span>
                    {x.payment_method}
                    {x.bill_to_partner_id
                      ? " · " +
                        (data.partners.find(
                          (p) => p.partner_id === x.bill_to_partner_id,
                        )?.partner_name ?? "거래처")
                      : ""}
                  </span>
                  <strong>{money(Number(x.amount))}</strong>
                </div>
              ))}
            {!data.payments.some(
              (x) => x.reservation_id === row.reservation_id,
            ) && <p className="muted">등록된 결제 내역이 없습니다.</p>}
            <h3>메모</h3>
            <p className="note">{row.note || "등록된 메모가 없습니다."}</p>
          </div>
          <footer>
            현재 조회 전용입니다. 체크인·수정 기능은 준비 중입니다.
          </footer>
        </div>
      )}
    </dialog>
  );
}
