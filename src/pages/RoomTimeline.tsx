import { useMemo, useState, type CSSProperties } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarDays,
  BedDouble,
} from "lucide-react";
import type { Dataset, ReservationRow } from "../lib/types";
import { roomStatus, stayStatus } from "../lib/roomStatus";
import { addDays, hotelDate, matchesSearch } from "../lib/domain";
import {
  dateDistance,
  nextMonth,
  placeBookings,
  roomFloor,
} from "../lib/timeline";
import { EmptyState, StatusBadge } from "../components/ui";
export function RoomTimeline({
  data,
  rows,
  propertyId,
  day,
  onDayChange,
  onSelect,
  onReservation,
  onCheckOut,
}: {
  data: Dataset;
  rows: ReservationRow[];
  propertyId: number;
  day: string;
  onDayChange: (day: string) => void;
  onSelect: (r: ReservationRow) => void;
  onReservation: () => void;
  onCheckOut: () => void;
}) {
  const [period, setPeriod] = useState("14"),
    [floor, setFloor] = useState(""),
    [type, setType] = useState(""),
    [search, setSearch] = useState("");
  const days = period === "14" ? 14 : dateDistance(day, nextMonth(day)),
    end = addDays(day, days),
    today = hotelDate();
  const dates = Array.from({ length: days }, (_, i) => addDays(day, i));
  const propertyRooms = data.rooms.filter((r) => r.property_id === propertyId);
  const floors = [
    ...new Set(propertyRooms.map((r) => roomFloor(r.room_number))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const rowMap = useMemo(
    () => new Map(rows.map((r) => [r.reservation_id, r])),
    [rows],
  );
  const items = data.reservationRooms.flatMap((item) => {
    const reservation = rowMap.get(item.reservation_id);
    return reservation ? [{ ...item, reservation }] : [];
  });
  const visible = propertyRooms
    .filter(
      (r) =>
        (!floor || roomFloor(r.room_number) === floor) &&
        (!type || r.room_type_id === Number(type)),
    )
    .sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
    )
    .map((room) => {
      const bookings = placeBookings(
        items
          .filter((x) => x.room_id === room.room_id)
          .map((x) => ({
            id: x.reservation_room_id,
            stayStatus: stayStatus(x, x.reservation),
            reservation: x.reservation,
          })),
        day,
        days,
      );
      const matchesRoom = room.room_number.includes(search.trim());
      return {
        room,
        bookings: bookings.filter(
          (b) => !search || matchesRoom || matchesSearch(b.reservation, search),
        ),
      };
    })
    .filter(
      (x) =>
        !search ||
        x.room.room_number.includes(search.trim()) ||
        x.bookings.length > 0,
    );
  const unassigned = items.filter(
    (x) =>
      x.room_id === null &&
      (!type || x.room_type_id === Number(type)) &&
      matchesSearch(x.reservation, search) &&
      stayStatus(x, x.reservation) !== "취소" &&
      x.reservation.check_in < end &&
      x.reservation.check_out > day,
  );
  const style = { "--timeline-days": days } as CSSProperties;
  return (
    <section className="timeline-panel" aria-label="객실별 예약 현황">
      <div className="timeline-toolbar">
        <div className="timeline-period">
          <CalendarDays size={17} />
          <strong>
            {day.replaceAll("-", ".")} — {addDays(end, -1).replaceAll("-", ".")}
          </strong>
          <button
            className="icon-button"
            aria-label="이전 기간"
            onClick={() =>
              onDayChange(
                period === "14" ? addDays(day, -14) : nextMonth(day, -1),
              )
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="다음 기간"
            onClick={() =>
              onDayChange(period === "14" ? addDays(day, 14) : nextMonth(day))
            }
          >
            <ChevronRight size={17} />
          </button>
          <button className="button" onClick={() => onDayChange(today)}>
            오늘
          </button>
        </div>
        <div className="period-switch" role="group" aria-label="표시 기간">
          <button
            aria-pressed={period === "14"}
            onClick={() => setPeriod("14")}
          >
            2주
          </button>
          <button
            aria-pressed={period === "month"}
            onClick={() => setPeriod("month")}
          >
            1개월
          </button>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={onReservation}
        >
          예약
        </button>
        <button type="button" className="button" onClick={onCheckOut}>
          퇴실
        </button>
      </div>
      <div className="timeline-filters">
        <div className="timeline-legend">
          <span>
            <i className="assigned" />
            배정 · 예약
          </span>
          <span>
            <i className="occupied" />
            재실
          </span>
          <span>
            <i className="departed" />
            퇴실
          </span>
          <span>
            <i className="broken" />
            고장
          </span>
        </div>
        <div className="timeline-filter-inputs">
          <select
            aria-label="층 필터"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          >
            <option value="">전체 층</option>
            {floors.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            aria-label="현황표 객실타입"
            value={type}
            onChange={(e) => setType(e.target.value)}
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
          <div className="filter-search">
            <Search size={15} />
            <input
              aria-label="현황표 검색"
              placeholder="고객명, 객실번호, 예약번호"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div
        className="timeline-scroll"
        tabIndex={0}
        aria-label="객실별 날짜 현황표, 가로 스크롤 가능"
      >
        <div
          className="timeline-grid"
          style={style}
          role="table"
          aria-label="객실 예약 현황표"
        >
          <div className="timeline-head" role="row">
            <div className="room-meta meta-head">
              <span role="columnheader">층</span>
              <span role="columnheader">객실번호</span>
              <span role="columnheader">타입</span>
              <span role="columnheader">현재 상태</span>
            </div>
            {dates.map((date) => {
              const weekday = new Date(date + "T00:00:00Z").getUTCDay();
              return (
                <div
                  role="columnheader"
                  key={date}
                  className={
                    "timeline-date " +
                    (date === today ? "is-today " : "") +
                    (weekday === 0 ? "sunday" : weekday === 6 ? "saturday" : "")
                  }
                >
                  <strong>{date.slice(5).replace("-", "/")}</strong>
                  <span>
                    {["일", "월", "화", "수", "목", "금", "토"][weekday]}
                  </span>
                </div>
              );
            })}
          </div>
          {visible.map(({ room, bookings }) => {
            const lanes = Math.max(1, ...bookings.map((b) => b.lane + 1));
            return (
              <div
                className={
                  "timeline-room " +
                  (room.is_out_of_order ? "out-of-order" : "")
                }
                key={room.room_id}
                role="row"
                style={{ height: Math.max(38, lanes * 29 + 7) }}
              >
                <div className="room-meta" role="rowheader">
                  <span>{roomFloor(room.room_number)}</span>
                  <strong>{room.room_number}</strong>
                  <span>
                    {data.roomTypes.find(
                      (t) => t.room_type_id === room.room_type_id,
                    )?.room_type_name ?? "—"}
                  </span>
                  <StatusBadge status={roomStatus(data, room)} />
                </div>
                <div className="room-track" role="cell">
                  <div className="timeline-cells" aria-hidden="true">
                    {dates.map((date) => (
                      <div
                        key={date}
                        className={date === today ? "is-today" : ""}
                      />
                    ))}
                  </div>
                  {room.is_out_of_order && (
                    <span className="out-of-order-label">
                      고장 · 현재 사용불가
                    </span>
                  )}
                  {bookings.map((b) => (
                    <button
                      key={b.id}
                      className={
                        "booking-bar " +
                        ((b.stayStatus ?? b.reservation.status) === "재실"
                          ? "occupied"
                          : (b.stayStatus ?? b.reservation.status) === "퇴실"
                            ? "departed"
                            : "assigned") +
                        (b.continuesBefore ? " continues-before" : "") +
                        (b.continuesAfter ? " continues-after" : "")
                      }
                      style={{
                        left: (b.start / days) * 100 + "%",
                        width: ((b.end - b.start) / days) * 100 + "%",
                        top: 4 + b.lane * 29,
                      }}
                      onClick={() => onSelect(b.reservation)}
                      aria-label={
                        room.room_number +
                        "호 " +
                        b.reservation.customer +
                        " " +
                        b.reservation.check_in +
                        " 입실 " +
                        b.reservation.check_out +
                        " 퇴실 " +
                        (b.stayStatus ?? b.reservation.status)
                      }
                      title={
                        b.reservation.customer +
                        " · " +
                        b.reservation.reference +
                        "\n" +
                        b.reservation.check_in +
                        " 입실 → " +
                        b.reservation.check_out +
                        " 퇴실 · " +
                        (b.stayStatus ?? b.reservation.status)
                      }
                    >
                      <span>
                        {b.continuesBefore ? "‹ " : ""}
                        {b.reservation.customer}
                      </span>
                      <small>
                        {b.stayStatus ?? b.reservation.status}
                        {b.continuesAfter ? " ›" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!visible.length && (
          <EmptyState
            title="표시할 객실이 없습니다"
            description="층·객실타입·검색 조건을 확인해 주세요."
          />
        )}
      </div>
      <div className="timeline-caption">
        <span>
          <BedDouble size={14} /> {visible.length}실 · {days}일 보기
        </span>
      </div>
      {unassigned.length > 0 && !floor && (
        <div className="unassigned">
          <div>
            <strong>객실 미배정</strong>
            <span>{unassigned.length}실</span>
          </div>
          <div className="unassigned-list">
            {unassigned.map((x) => (
              <button
                key={x.reservation_room_id}
                onClick={() => onSelect(x.reservation)}
              >
                <strong>{x.reservation.customer}</strong>
                <span>
                  {x.reservation.check_in.slice(5)} →{" "}
                  {x.reservation.check_out.slice(5)}
                </span>
                <StatusBadge status={stayStatus(x, x.reservation)} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
