import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopupClose } from "../../lib/usePopupClose";
import { X } from "lucide-react";
import type { RoomType } from "../../lib/types";
import type { RoomConfiguration } from "../../lib/reservationPricing";

export function RoomDetailsDialog({
  roomTypes,
  rooms,
  onApply,
  onClose: onClosed,
}: {
  roomTypes: RoomType[];
  rooms: RoomConfiguration[];
  onApply: (rooms: RoomConfiguration[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onClose = usePopupClose(ref, onClosed);
  const all = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(
    () => new Set(rooms.map((r) => r.room_type_id)),
  );
  const [counts, setCounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      roomTypes.map((t) => [
        t.room_type_id,
        String(
          rooms.find((r) => r.room_type_id === t.room_type_id)?.count ?? 0,
        ),
      ]),
    ),
  );
  const chosen = roomTypes.filter((t) => selected.has(t.room_type_id));
  const total = chosen.reduce(
    (sum, t) => sum + Number(counts[t.room_type_id]),
    0,
  );
  const valid =
    chosen.every(
      (t) =>
        counts[t.room_type_id].trim() !== "" &&
        Number.isInteger(Number(counts[t.room_type_id])) &&
        Number(counts[t.room_type_id]) >= 1 &&
        Number(counts[t.room_type_id]) <= 100,
    ) && total <= 100;
  useEffect(() => {
    if (all.current)
      all.current.indeterminate =
        chosen.length > 0 && chosen.length < roomTypes.length;
  }, [chosen.length, roomTypes.length]);
  function apply() {
    if (!valid) return;
    const retained = rooms.filter((r) => selected.has(r.room_type_id));
    const added: RoomConfiguration[] = chosen
      .filter((t) => !rooms.some((r) => r.room_type_id === t.room_type_id))
      .map((t) => ({ room_type_id: t.room_type_id, count: Number(counts[t.room_type_id]) }));
    onApply(
      [...retained, ...added].map((r) => ({
        ...r,
        count: Number(counts[r.room_type_id]),
        room_ids: r.room_ids?.slice(0, Number(counts[r.room_type_id])),
      })),
    );
    onClose();
  }
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="reservation-select-dialog room-details-dialog"
      aria-label="객실 구성 자세히"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header className="reservation-dialog-header">
        <h2>객실 구성</h2>
        <button
          type="button"
          className="button"
          aria-label="객실 구성 닫기"
          onClick={onClose}
        >
          <X size={17} />
          닫기
        </button>
      </header>
      <div className="room-details-body">
        <p className="room-details-hint">
          예약할 객실타입을 선택하고 수량을 입력하세요.
        </p>
        <label className="room-type-check">
          <input
            ref={all}
            type="checkbox"
            aria-label="객실타입 전체 선택"
            checked={roomTypes.length > 0 && chosen.length === roomTypes.length}
            disabled={!roomTypes.length}
            onChange={(e) =>
              setSelected(
                new Set(
                  e.target.checked ? roomTypes.map((t) => t.room_type_id) : [],
                ),
              )
            }
          />
          전체 선택
        </label>
        <div className="room-type-options">
          {roomTypes.map((t) => (
            <div
              className={
                "room-type-option" +
                (selected.has(t.room_type_id) ? " is-selected" : "")
              }
              key={t.room_type_id}
            >
              <label className="room-type-check">
                <input
                  type="checkbox"
                  aria-label={`${t.room_type_name} 선택`}
                  checked={selected.has(t.room_type_id)}
                  onChange={(e) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (e.target.checked) next.add(t.room_type_id);
                      else next.delete(t.room_type_id);
                      return next;
                    })
                  }
                />
                {t.room_type_name}
              </label>
              <label className="room-type-count">
                객실수{" "}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  aria-label={`${t.room_type_name} 객실 수`}
                  disabled={!selected.has(t.room_type_id)}
                  value={counts[t.room_type_id]}
                  onChange={(e) =>
                    setCounts((old) => ({
                      ...old,
                      [t.room_type_id]: e.target.value,
                    }))
                  }
                />
                실
              </label>
            </div>
          ))}
        </div>
        {!roomTypes.length && (
          <p className="room-details-hint">등록된 객실타입이 없습니다.</p>
        )}
        {!valid && (
          <p role="alert" className="error-text">
            수량은 타입별 1실 이상, 전체 100실 이하의 정수로 입력하세요.
          </p>
        )}
      </div>
      <footer className="assignment-footer">
        <span>
          {chosen.length}개 타입 · {valid ? total : "—"}실
        </span>
        <button type="button" className="button" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!valid || !roomTypes.length}
          onClick={apply}
        >
          적용
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
