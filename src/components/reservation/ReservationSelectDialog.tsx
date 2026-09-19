import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopupClose } from "../../lib/usePopupClose";
import { Search, X } from "lucide-react";

export interface ReservationOption {
  id: number;
  label: string;
  detail: string;
}
export function ReservationSelectDialog({
  title,
  searchLabel,
  options,
  selectedId,
  onSelect,
  onClose: onClosed,
}: {
  title: string;
  searchLabel: string;
  options: ReservationOption[];
  selectedId?: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onClose = usePopupClose(ref, onClosed);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    searchRef.current?.focus();
  }, []);
  const query = search.trim().toLocaleLowerCase();
  const filtered = options.filter((o) =>
    `${o.label} ${o.detail}`.toLocaleLowerCase().includes(query),
  );
  return createPortal(
    <dialog
      className="reservation-select-dialog"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header className="reservation-dialog-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="button"
          aria-label={`${title} 닫기`}
          onClick={onClose}
        >
          <X size={17} />
          닫기
        </button>
      </header>
      <div className="reservation-selection-body">
        <label className="reservation-selection-search">
          <Search size={17} />
          <span className="sr-only">{searchLabel}</span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchLabel}
          />
        </label>
        <p className="muted">검색 결과 {filtered.length}건</p>
        <div className="reservation-selection-list">
          {filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              className={selectedId === o.id ? "selected" : ""}
              aria-pressed={selectedId === o.id}
              onClick={() => {
                onSelect(o.id);
                onClose();
              }}
            >
              <strong>{o.label}</strong>
              <span>{o.detail}</span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <p className="reservation-empty">검색 결과가 없습니다.</p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
