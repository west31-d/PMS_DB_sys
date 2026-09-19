import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { NewReservation } from "../../pages/NewReservation";
import type { Dataset } from "../../lib/types";
import { usePopupClose } from "../../lib/usePopupClose";

export function ReservationCreateDialog({
  open,
  onClose: onClosed,
  ...form
}: {
  open: boolean;
  onClose: () => void;
  data: Dataset;
  propertyId: number;
  day: string;
  live: boolean;
  onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const onClose = usePopupClose(dialog, onClosed);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    if (!dialog.current?.open) dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="reservation-create-dialog"
      aria-labelledby="reservation-create-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="reservation-dialog-header">
        <h2 id="reservation-create-title">
          <CalendarDays size={20} /> 예약
        </h2>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onClose}
          aria-label="예약 창 닫기"
        >
          <X size={17} /> 닫기
        </button>
      </header>
      <div className="reservation-dialog-body">
        {open && (
          <NewReservation {...form} onClose={onClose} onSavingChange={setBusy} />
        )}
      </div>
    </dialog>
  );
}
