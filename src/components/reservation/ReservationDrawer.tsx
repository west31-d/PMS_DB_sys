import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { X, BedDouble } from "lucide-react";
import type { Dataset, ReservationRow } from "../../lib/types";
import { stayStatus } from "../../lib/roomStatus";
import { money } from "../../lib/domain";
import { StatusBadge } from "../ui";
export function ReservationDrawer({
  row,
  data,
  onClose,
  live,
  onUpdated,
}: {
  row: ReservationRow | null;
  data: Dataset;
  onClose: () => void;
  live: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [closing, setClosing] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    setError("");
    setMessage("");
    setClosing(false);
  }, [row?.reservation_id]);
  function requestClose() {
    if (!pending.current) setClosing(true);
  }
  useEffect(() => {
    if (!closing) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timeout = window.setTimeout(onClose, reducedMotion ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [closing, onClose]);
  async function checkIn(id: number) {
    if (!live || !supabase || pending.current || closing) return;
    pending.current = true;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const result = await supabase.rpc("pms_check_in_room", {
        p_reservation_room_id: id,
      });
      if (result.error) throw result.error;
      setMessage("입실 처리되었습니다.");
      try {
        await onUpdated();
      } catch {
        setError(
          "입실은 처리되었지만 화면 갱신에 실패했습니다. 새로고침해 주세요.",
        );
      }
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "입실 처리에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const booking = row
    ? (data.reservations.find((r) => r.reservation_id === row.reservation_id) ??
      row)
    : null;
  useEffect(() => {
    const el = dialog.current;
    if (row && !el?.open) el?.showModal();
    if (!row && el?.open) el.close();
  }, [row]);
  return (
    <dialog
      aria-label="예약 상세"
      className={"reservation-drawer" + (closing ? " is-closing" : "")}
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
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
              disabled={busy !== null || closing}
              onClick={requestClose}
            >
              <X size={21} />
            </button>
          </header>
          <div className="drawer-body">
            <div className="detail-heading">
              <h2>{row.customer}</h2>
              <StatusBadge
                status={
                  data.reservations.find(
                    (r) => r.reservation_id === row.reservation_id,
                  )?.status ?? row.status
                }
              />
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
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            {message && <p role="status">{message}</p>}
            {!live && (
              <p className="muted">
                입실 처리는 실제 DB 연결 모드에서 가능합니다.
              </p>
            )}
            {data.reservationRooms
              .filter((x) => x.reservation_id === row.reservation_id)
              .map((x) => (
                <div className="detail-card" key={x.reservation_room_id}>
                  <div className="detail-card-header">
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
                    <button
                      type="button"
                      className="button primary"
                      aria-label={`${data.rooms.find((r) => r.room_id === x.room_id)?.room_number ?? "미배정"}호 입실`}
                      disabled={
                        !live ||
                        closing ||
                        busy !== null ||
                        !x.room_id ||
                        stayStatus(x, booking ?? row) !== "예약" ||
                        !["예약", "재실"].includes((booking ?? row).status)
                      }
                      onClick={() => checkIn(x.reservation_room_id)}
                    >
                      {busy === x.reservation_room_id
                        ? "입실 처리 중…"
                        : stayStatus(x, booking ?? row) === "재실"
                          ? "입실 완료"
                          : !x.room_id
                            ? "호수 배정 필요"
                            : "입실"}
                    </button>
                  </div>
                  <dl className="detail-grid">
                    <dt>입실 상태</dt>
                    <dd>{stayStatus(x, booking ?? row)}</dd>
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
        </div>
      )}
    </dialog>
  );
}
