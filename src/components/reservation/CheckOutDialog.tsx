import { useEffect, useRef, useState } from "react";
import { LogOut, X } from "lucide-react";
import type { Dataset } from "../../lib/types";
import {
  hotelDate,
  matchesSearch,
  money,
  reservationRows,
} from "../../lib/domain";
import { stayStatus } from "../../lib/roomStatus";
import { reservationBalance } from "../../lib/checkOut";
import { usePopupClose } from "../../lib/usePopupClose";
import { supabase } from "../../lib/supabase";
import { StatusBadge } from "../ui";
import "../../checkOut.css";

export function CheckOutDialog({
  data,
  propertyId,
  live,
  onClose,
  onUpdated,
}: {
  data: Dataset;
  propertyId: number;
  live: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = usePopupClose(ref, onClose);
  const [tab, setTab] = useState("due");
  const [day, setDay] = useState(hotelDate);
  const [search, setSearch] = useState("");
  const [id, setId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshFailed, setRefreshFailed] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  const all = reservationRows(data, propertyId);
  const rows = all.filter(
    (r) =>
      matchesSearch(r, search) &&
      data.reservationRooms.some(
        (line) =>
          line.reservation_id === r.reservation_id &&
          (tab === "done"
            ? stayStatus(line, r) === "퇴실" && r.check_out === day
            : stayStatus(line, r) === "재실" &&
              (tab === "staying" || r.check_out === hotelDate())),
      ),
  );
  const booking = all.find((r) => r.reservation_id === id);
  const folio = booking
    ? reservationBalance(data, booking.reservation_id)
    : null;
  const occupied =
    folio?.rooms.filter(
      (r) => booking && r.room_id !== null && stayStatus(r, booking) === "재실",
    ) ?? [];
  const selectedIds = selected.filter((id) =>
    occupied.some((r) => r.reservation_room_id === id),
  );
  function choose(next: number) {
    setId(next);
    setSelected([]);
    setError("");
    setMessage("");
  }
  async function refresh() {
    await onUpdated();
    setRefreshFailed(false);
  }
  async function checkOut() {
    if (
      !booking ||
      !supabase ||
      !live ||
      !selectedIds.length ||
      pending.current ||
      refreshFailed
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabase.rpc("pms_check_out_rooms", {
        p_reservation_id: booking.reservation_id,
        p_room_ids: selectedIds,
      });
      if (error) throw error;
      setSelected([]);
      setMessage(
        `${selectedIds.length}실 퇴실 처리되었습니다. 객실 정비 상태는 미정비로 변경됩니다.`,
      );
      try {
        await refresh();
      } catch {
        setRefreshFailed(true);
        setError(
          "퇴실은 완료됐지만 목록 갱신에 실패했습니다. 다시 불러오기를 눌러 주세요.",
        );
      }
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "퇴실 처리에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="reservation-create-dialog checkout-dialog"
      aria-label="퇴실"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending.current) close();
      }}
    >
      <header className="reservation-dialog-header">
        <h2>
          <LogOut size={20} />
          퇴실
        </h2>
        <button
          className="button"
          disabled={busy}
          onClick={close}
          aria-label="퇴실 창 닫기"
        >
          <X size={17} />
          닫기
        </button>
      </header>
      <div className="checkout-layout">
        <aside className="checkout-list">
          <div
            className="checkout-tabs"
            role="group"
            aria-label="퇴실 목록 구분"
          >
            {[
              ["due", "퇴실 예정"],
              ["staying", "투숙객"],
              ["done", "퇴실 완료"],
            ].map(([value, label]) => (
              <button
                className="button"
                key={value}
                aria-pressed={tab === value}
                disabled={busy}
                onClick={() => {
                  setTab(value);
                  choose(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "due" && (
            <label>체크아웃 날짜<input type="date" readOnly value={hotelDate()} /></label>
          )}
          {tab === "done" && (
            <label>
              퇴실 예정일
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  choose(0);
                }}
              />
            </label>
          )}
          <label>
            검색
            <input
              placeholder="고객명, 객실번호, 예약번호"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <p className="muted">
            {rows.length}건{tab === "done" && " · 퇴실 예정일 기준"}
          </p>
          <div className="checkout-bookings">
            {rows.map((r) => (
              <button
                key={r.reservation_id}
                className={id === r.reservation_id ? "is-selected" : ""}
                disabled={busy}
                onClick={() => choose(r.reservation_id)}
              >
                <strong>{r.customer}</strong>
                <span>{r.roomLabel}</span>
                <small>
                  {r.reference} · 잔액{" "}
                  {money(reservationBalance(data, r.reservation_id).balance)}
                </small>
              </button>
            ))}
            {!rows.length && (
              <p className="muted">조건에 맞는 예약이 없습니다.</p>
            )}
          </div>
        </aside>
        <main className="checkout-detail">
          {!booking || !folio ? (
            <p className="checkout-empty">목록에서 퇴실할 예약을 선택하세요.</p>
          ) : (
            <>
              <section className="reservation-card">
                <h3>
                  {booking.customer}
                  <span>{booking.reference}</span>
                </h3>
                <dl className="checkout-info">
                  <div>
                    <dt>체크인</dt>
                    <dd>{booking.check_in}</dd>
                  </div>
                  <div>
                    <dt>퇴실 예정일</dt>
                    <dd>{booking.check_out}</dd>
                  </div>
                  <div>
                    <dt>거래처</dt>
                    <dd>{booking.partner}</dd>
                  </div>
                  <div>
                    <dt>예약 상태</dt>
                    <dd>
                      <StatusBadge status={booking.status} />
                    </dd>
                  </div>
                  <div className="checkout-note">
                    <dt>비고</dt>
                    <dd>{booking.note || "—"}</dd>
                  </div>
                </dl>
              </section>
              <section className="reservation-card">
                <h3>
                  객실 선택
                  <button
                    className="button"
                    disabled={busy || !occupied.length}
                    onClick={() =>
                      setSelected(
                        selectedIds.length === occupied.length
                          ? []
                          : occupied.map((r) => r.reservation_room_id),
                      )
                    }
                  >
                    재실 객실 전체 선택
                  </button>
                </h3>
                <div className="checkout-rooms">
                  {folio.rooms.map((line) => (
                    <label key={line.reservation_room_id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(line.reservation_room_id)}
                        disabled={busy || !occupied.includes(line)}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, line.reservation_room_id]
                              : old.filter(
                                  (v) => v !== line.reservation_room_id,
                                ),
                          )
                        }
                      />
                      <strong>
                        {data.rooms.find((r) => r.room_id === line.room_id)
                          ?.room_number ?? "미배정"}{" "}
                        {
                          data.roomTypes.find(
                            (t) => t.room_type_id === line.room_type_id,
                          )?.room_type_name
                        }
                      </strong>
                      <StatusBadge status={stayStatus(line, booking)} />
                      <span>{money(Number(line.rate_amount))}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="reservation-card">
                <h3>예약 전체 잔액</h3>
                <div className="checkout-totals">
                  {[
                    ["객실 요금", folio.roomAmount],
                    ["부대서비스", folio.extraAmount],
                    ["결제 합계", folio.paid],
                    ["잔액", folio.balance],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{money(Number(value))}</strong>
                    </div>
                  ))}
                </div>
                <p className="checkout-hint">
                  잔액은 예약 전체 기준입니다. 퇴실 처리로 요금·결제 내역은
                  변경되지 않습니다.
                  {folio.balance < 0 && " 초과 결제 금액이 있습니다."}
                </p>
              </section>
              <section className="reservation-card">
                <h3>부대서비스 · 결제 내역</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>일시</th>
                        <th>구분</th>
                        <th>내용</th>
                        <th>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...folio.charges.map((c) => ({
                          key: `c${c.reservation_charge_id}`,
                          date: c.charged_at,
                          type: "부대서비스",
                          label: `${data.chargeItems.find((i) => i.charge_item_id === c.charge_item_id)?.item_name ?? "서비스"} × ${c.quantity}`,
                          amount: Number(c.unit_price) * c.quantity,
                        })),
                        ...folio.payments.map((p) => ({
                          key: `p${p.payment_id}`,
                          date: p.paid_at,
                          type: "결제",
                          label:
                            p.payment_method +
                            (p.bill_to_partner_id
                              ? ` · ${data.partners.find((t) => t.partner_id === p.bill_to_partner_id)?.partner_name ?? "거래처"}`
                              : ""),
                          amount: Number(p.amount),
                        })),
                      ]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((entry) => (
                          <tr key={entry.key}>
                            <td>
                              {new Date(entry.date).toLocaleString("ko-KR", {
                                timeZone: "Asia/Seoul",
                              })}
                            </td>
                            <td>{entry.type}</td>
                            <td>{entry.label}</td>
                            <td>{money(entry.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!folio.charges.length && !folio.payments.length && (
                    <p className="checkout-hint">등록된 내역이 없습니다.</p>
                  )}
                </div>
              </section>
              {!live && (
                <p className="checkout-hint">
                  퇴실 처리는 운영 DB 연결 시 사용할 수 있습니다.
                </p>
              )}
              {message && <p role="status">{message}</p>}
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              {refreshFailed && (
                <button
                  className="button"
                  onClick={() =>
                    refresh().catch(() =>
                      setError("목록 갱신에 실패했습니다. 다시 시도해 주세요."),
                    )
                  }
                >
                  다시 불러오기
                </button>
              )}
              <footer className="checkout-actions">
                <span>선택 {selectedIds.length}실 · 퇴실 후 미정비</span>
                <button
                  className="button primary"
                  disabled={
                    !live || busy || refreshFailed || !selectedIds.length
                  }
                  onClick={checkOut}
                >
                  {busy ? "퇴실 처리 중…" : "선택 객실 퇴실"}
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
    </dialog>
  );
}
