import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopupClose } from "../../lib/usePopupClose";
import { stayStatus } from "../../lib/roomStatus";
import type { Dataset } from "../../lib/types";

export interface RoomAllocation {
  key: number;
  type: string;
  room: string;
}
export function RoomAssignmentDialog({
  data,
  propertyId,
  checkIn,
  checkOut,
  allocations,
  initialKey,
  onApply,
  onClose: onClosed,
}: {
  data: Dataset;
  propertyId: number;
  checkIn: string;
  checkOut: string;
  allocations: RoomAllocation[];
  initialKey: number;
  onApply: (rooms: RoomAllocation[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onClose = usePopupClose(ref, onClosed);
  const [draft, setDraft] = useState(() => allocations.map((r) => ({ ...r })));
  const [targetKey, setTargetKey] = useState(initialKey);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const target = draft.find((r) => r.key === targetKey)!;
  const typeName = (type: string) =>
    data.roomTypes.find((t) => t.room_type_id === Number(type))
      ?.room_type_name ?? "타입 미선택";
  const occupied = new Set(
    data.reservationRooms
      .filter((rr) =>
        data.reservations.some(
          (r) =>
            r.reservation_id === rr.reservation_id &&
            ["예약", "재실"].includes(stayStatus(rr, r)) &&
            r.check_in < checkOut &&
            r.check_out > checkIn,
        ),
      )
      .map((rr) => rr.room_id),
  );
  const candidates = data.rooms.filter(
    (r) =>
      r.property_id === propertyId &&
      r.room_type_id === Number(target.type) &&
      !r.is_out_of_order &&
      !occupied.has(r.room_id) &&
      r.room_number.includes(search.trim()) &&
      (!status || r.housekeeping_status === status),
  );
  const validDates = !!checkIn && !!checkOut && checkOut > checkIn;
  const setRoom = (key: number, room: string) =>
    setDraft((old) => old.map((r) => (r.key === key ? { ...r, room } : r)));
  return createPortal(
    <dialog
      ref={ref}
      className="room-assignment-dialog"
      aria-labelledby="assignment-title"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header className="reservation-dialog-header">
        <h2 id="assignment-title">객실 배정</h2>
        <button className="button" type="button" onClick={onClose}>
          배정 창 닫기
        </button>
      </header>
      <div className="assignment-body">
        <p className="assignment-dates">
          {checkIn || "입실일 미선택"} → {checkOut || "퇴실일 미선택"} ·{" "}
          {draft.length}실 중 {draft.filter((r) => r.room).length}실 배정
        </p>
        {!validDates && (
          <p role="alert" className="error-text">
            입실일과 퇴실일을 먼저 확인하세요.
          </p>
        )}
        <div className="assignment-columns">
          <section>
            <h3>배정 가능한 객실 · {typeName(target.type)}</h3>
            <div className="assignment-filters">
              <label>
                객실번호 검색
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="예: 0301"
                />
              </label>
              <label>
                정비 상태
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">전체</option>
                  {[
                    ...new Set(data.rooms.map((r) => r.housekeeping_status)),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="reservation-hint">
              선택한 숙박 기간의 예약과 고장 객실을 제외했습니다.
            </p>
            <div className="assignment-room-list">
              {validDates &&
                candidates.map((r) => {
                  const selected = target.room === String(r.room_id);
                  const assignedElsewhere = draft.some(
                    (line) =>
                      line.key !== target.key &&
                      line.room === String(r.room_id),
                  );
                  return (
                    <button
                      key={r.room_id}
                      type="button"
                      className={
                        "assignment-room " + (selected ? "selected" : "")
                      }
                      disabled={assignedElsewhere}
                      aria-pressed={selected}
                      aria-label={`${r.room_number}호 배정`}
                      onClick={() =>
                        setRoom(target.key, selected ? "" : String(r.room_id))
                      }
                    >
                      <strong>{r.room_number}</strong>
                      <span>{r.housekeeping_status}</span>
                      <small>
                        {assignedElsewhere
                          ? "다른 객실에 선택됨"
                          : selected
                            ? "선택됨"
                            : "선택"}
                      </small>
                    </button>
                  );
                })}
              {(!validDates || !candidates.length) && (
                <p className="reservation-hint">
                  조건에 맞는 배정 가능한 객실이 없습니다.
                </p>
              )}
            </div>
          </section>
          <section>
            <h3>이번 예약의 객실</h3>
            <p className="reservation-hint">
              배정할 항목을 선택한 뒤 왼쪽 목록에서 방을 고르세요.
            </p>
            <div className="assignment-targets">
              {draft.map((r, i) => (
                <div
                  className={
                    "assignment-target " +
                    (r.key === targetKey ? "selected" : "")
                  }
                  key={r.key}
                >
                  <button
                    type="button"
                    aria-pressed={r.key === targetKey}
                    onClick={() => {
                      setTargetKey(r.key);
                      setSearch("");
                      setStatus("");
                    }}
                  >
                    <strong>
                      객실 {i + 1} · {typeName(r.type)}
                    </strong>
                    <span>
                      {data.rooms.find(
                        (room) => room.room_id === Number(r.room),
                      )?.room_number ?? "미배정"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    aria-label={`객실 ${i + 1} 배정 해제`}
                    disabled={!r.room}
                    onClick={() => setRoom(r.key, "")}
                  >
                    해제
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <footer className="assignment-footer">
        <span>적용을 누르면 예약 정보에 반영됩니다.</span>
        <button type="button" className="button" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!validDates}
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          배정 적용
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
