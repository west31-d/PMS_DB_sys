import { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { ReservationTable } from "../components/table/ReservationTable";
import { defaultCheckInFilters } from "../lib/checkIns";
import { hotelDate, matchesSearch, reservationRows } from "../lib/domain";
import type { Dataset, ReservationRow } from "../lib/types";
import "../checkIns.css";

export function Reservations({
  data,
  propertyId,
  onSelect,
  initialSearch = "",
}: {
  data: Dataset;
  propertyId: number;
  onSelect: (row: ReservationRow) => void;
  initialSearch?: string;
}) {
  const defaults = () => ({
    ...defaultCheckInFilters(hotelDate()),
    status: "",
  });
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const includes = (value: string, search: string) =>
    value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const rows = reservationRows(data, propertyId).filter(
    (r) =>
      r.check_in >= applied.from &&
      r.check_in <= applied.to &&
      matchesSearch(r, initialSearch) &&
      includes(r.customer, applied.customer) &&
      includes(r.reference + " " + r.searchRefs, applied.reference) &&
      (!applied.partnerId ||
        String(r.booking_partner_id) === applied.partnerId) &&
      (!applied.status || r.status === applied.status) &&
      ((!applied.roomTypeId && !applied.roomNumber.trim()) ||
        data.reservationRooms.some(
          (line) =>
            line.reservation_id === r.reservation_id &&
            (!applied.roomTypeId ||
              String(line.room_type_id) === applied.roomTypeId) &&
            (!applied.roomNumber.trim() ||
              data.rooms.some(
                (room) =>
                  room.room_id === line.room_id &&
                  includes(room.room_number, applied.roomNumber),
              )),
        )),
  );
  return (
    <div className="checkin-layout">
      <form
        className="checkin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.from || !draft.to || draft.from > draft.to) {
            setError("체크인 시작일은 종료일보다 늦을 수 없습니다.");
            return;
          }
          setError("");
          setApplied({ ...draft });
          setRevision((v) => v + 1);
        }}
      >
        <div className="checkin-filter-title">
          <SlidersHorizontal size={17} />
          <strong>조회 조건</strong>
        </div>
        <label>
          프로퍼티
          <input
            readOnly
            value={
              data.properties.find((p) => p.property_id === propertyId)
                ?.property_name ?? ""
            }
          />
        </label>
        <fieldset>
          <legend>
            체크인 날짜 <span>*</span>
          </legend>
          <div className="checkin-date-range">
            <input
              aria-label="체크인 시작일"
              type="date"
              required
              value={draft.from}
              onChange={(e) => change("from", e.target.value)}
            />
            <span>~</span>
            <input
              aria-label="체크인 종료일"
              type="date"
              required
              value={draft.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </div>
        </fieldset>
        <label>
          고객명
          <input
            value={draft.customer}
            placeholder="고객명 입력"
            onChange={(e) => change("customer", e.target.value)}
          />
        </label>
        <label>
          객실번호
          <input
            value={draft.roomNumber}
            placeholder="예: 301"
            onChange={(e) => change("roomNumber", e.target.value)}
          />
        </label>
        <label>
          예약번호
          <input
            value={draft.reference}
            placeholder="내부 / 외부 예약번호"
            onChange={(e) => change("reference", e.target.value)}
          />
        </label>
        <label>
          거래처
          <select
            aria-label="거래처"
            value={draft.partnerId}
            onChange={(e) => change("partnerId", e.target.value)}
          >
            <option value="">전체 거래처</option>
            {data.partners.map((p) => (
              <option key={p.partner_id} value={p.partner_id}>
                {p.partner_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          객실타입
          <select
            aria-label="객실타입"
            value={draft.roomTypeId}
            onChange={(e) => change("roomTypeId", e.target.value)}
          >
            <option value="">전체 객실타입</option>
            {data.roomTypes
              .filter((t) => t.property_id === propertyId)
              .map((t) => (
                <option key={t.room_type_id} value={t.room_type_id}>
                  {t.room_type_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          예약 상태
          <select
            aria-label="예약 상태"
            value={draft.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">전체 상태</option>
            {["예약", "재실", "퇴실", "취소"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="checkin-filter-actions">
          <button className="button primary" type="submit">
            <Search size={15} />
            조회
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              const next = defaults();
              setDraft(next);
              setApplied(next);
              setError("");
              setRevision((v) => v + 1);
            }}
          >
            <RotateCcw size={14} />
            초기화
          </button>
        </div>
      </form>
      <section className="checkin-results" aria-label="예약 조회 결과">
        <div className="checkin-result-toolbar">
          <div>
            <strong>예약 목록 · {rows.length}건</strong>
            <span>
              {applied.from} ~ {applied.to} · 체크인 날짜 기준 · 객실 미배정
              포함
            </span>
          </div>
        </div>
        <ReservationTable
          key={revision}
          rows={rows}
          onSelect={onSelect}
          showFilters={false}
          fullDates
        />
      </section>
    </div>
  );
}
