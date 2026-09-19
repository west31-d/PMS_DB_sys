import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble,
  CalendarDays,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Dataset } from "../lib/types";
import { addDays } from "../lib/domain";
import {
  createReservation,
  validateReservation,
  type ReservationInput,
  type SavedReservation,
} from "../lib/createReservation";
import {
  pricedRooms,
  reservationMoney as money,
  stayNights,
  type RoomConfiguration,
} from "../lib/reservationPricing";
import { ReservationSelectDialog } from "../components/reservation/ReservationSelectDialog";
import { RoomDetailsDialog } from "../components/reservation/RoomDetailsDialog";
import { RoomAssignmentDialog } from "../components/reservation/RoomAssignmentDialog";
import "../reservation.css";

type ServiceLine = {
  key: number;
  item: string;
  date: string;
  quantity: string;
  price: string;
};
type Picker = "partner" | null;
export function NewReservation({
  data,
  propertyId,
  day,
  live,
  onSaved,
  onClose,
  onSavingChange,
}: {
  data: Dataset;
  propertyId: number;
  day: string;
  live: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onSavingChange: (busy: boolean) => void;
}) {
  const roomTypes = data.roomTypes.filter((r) => r.property_id === propertyId);
  const services = data.chargeItems.filter(
    (s) => s.property_id === propertyId && s.is_active,
  );
  const [customer, setCustomer] = useState("");
  const [checkIn, setCheckIn] = useState(day);
  const [checkOut, setCheckOut] = useState(addDays(day, 1));
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [rooms, setRooms] = useState<RoomConfiguration[]>([]);
  const [charges, setCharges] = useState<ServiceLine[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [assignmentKey, setAssignmentKey] = useState<number | null>(null);
  const allocations = rooms
    .flatMap((r) =>
      Array.from({ length: r.count }, (_, index) => ({
        type: String(r.room_type_id),
        room: r.room_ids?.[index] ? String(r.room_ids[index]) : "",
      })),
    )
    .map((r, key) => ({ ...r, key }));
  const clearAssignments = () =>
    setRooms((old) => old.map((r) => ({ ...r, room_ids: [] })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedReservation | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);
  const saving = useRef(false);
  const nights = stayNights(checkIn, checkOut);
  const currentRates = rooms
    .filter(
      (r) =>
        r.nightly_rate?.trim() &&
        Number.isFinite(Number(r.nightly_rate)) &&
        Number(r.nightly_rate) >= 0,
    )
    .map((r) => ({
      room_type_id: r.room_type_id,
      nightly_rate: Number(r.nightly_rate),
    }));
  const rateFor = (typeId: number) =>
    currentRates.find((r) => r.room_type_id === typeId);
  const allRatesKnown =
    rooms.length > 0 && rooms.every((r) => rateFor(r.room_type_id));
  let roomTotal: number | null = null;
  let roomError = "";
  if (allRatesKnown && nights > 0) {
    try {
      roomTotal =
        pricedRooms(rooms, currentRates, nights).reduce(
          (sum, r) => sum + Math.round(r.rate_amount * 100),
          0,
        ) / 100;
    } catch (e) {
      roomError = e instanceof Error ? e.message : "객실 구성을 확인하세요.";
    }
  }
  const validServices = charges.every(
    (s) =>
      s.quantity !== "" &&
      Number.isInteger(Number(s.quantity)) &&
      Number(s.quantity) > 0 &&
      s.price !== "" &&
      Number.isFinite(Number(s.price)) &&
      Number(s.price) >= 0,
  );
  const serviceTotal =
    charges.reduce(
      (sum, s) =>
        sum + Math.round(Number(s.price || 0) * 100) * Number(s.quantity || 0),
      0,
    ) / 100;
  const totalCount = rooms.reduce((sum, r) => sum + r.count, 0);
  const selectedPartner = data.partners.find((p) => p.partner_id === partnerId);

  useEffect(() => {
    onSavingChange(busy);
  }, [busy, onSavingChange]);
  function reset() {
    setSaved(null);
    setError("");
    setRefreshError("");
    request.current = null;
    setCustomer("");
    setCheckIn(day);
    setCheckOut(addDays(day, 1));
    setPartnerId(null);
    setReference("");
    setNote("");
    setRooms([]);
    setCharges([]);
  }
  const updateCharge = (key: number, patch: Partial<ServiceLine>) =>
    setCharges((old) =>
      old.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  async function save() {
    if (saving.current || saved || !live) return;
    setError("");
    if (!data.properties.some((p) => p.property_id === propertyId)) {
      setError("프로퍼티를 선택하세요.");
      return;
    }
    if (!selectedPartner) {
      setError("예약 거래처를 선택하세요.");
      return;
    }
    if (!allRatesKnown) {
      setError("객실타입별 1박 요금을 입력하세요.");
      return;
    }
    let input: ReservationInput;
    try {
      input = {
        property_id: propertyId,
        customer_id: null,
        customer_name: customer.trim(),
        booking_partner_id: partnerId,
        check_in: checkIn,
        check_out: checkOut,
        note: note.trim(),
        external_reference: reference.trim(),
        rooms: pricedRooms(rooms, currentRates, nights),
        charges: charges.map((s) => ({
          charge_item_id: Number(s.item),
          service_date: s.date,
          quantity: Number(s.quantity),
          unit_price: Number(s.price),
        })),
      };
      const invalid = validateReservation(input);
      if (invalid) throw new Error(invalid);
      if (
        rooms.some(
          (r) => !roomTypes.some((t) => t.room_type_id === r.room_type_id),
        )
      )
        throw new Error("객실타입 정보를 찾을 수 없습니다.");
      if (
        charges.some(
          (s) =>
            !services.some((item) => item.charge_item_id === Number(s.item)),
        )
      )
        throw new Error("사용할 수 있는 부대서비스를 선택하세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "예약 정보를 확인하세요.");
      return;
    }
    const payload = JSON.stringify(input);
    if (request.current?.payload !== payload)
      request.current = { payload, id: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    try {
      const result = await createReservation(request.current.id, input);
      setSaved(result);
      try {
        await onSaved();
      } catch {
        setRefreshError(
          "예약은 저장되었습니다. 목록 갱신에 실패했으므로 새로고침해 주세요.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "예약 저장 중 오류가 발생했습니다. 입력 내용을 유지했으니 다시 시도하세요.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const saveDisabled =
    !live || busy || !!saved || !allRatesKnown || !!roomError;

  return (
    <form
      className="reservation-editor reservation-revised"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="reservation-toolbar">
        <div>
          <span className="eyebrow">NEW RESERVATION</span>
          <h2>새 예약 입력</h2>
          <p>예약 정보를 입력한 뒤 객실타입과 객실 수를 선택하세요.</p>
        </div>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={reset}
        >
          <Plus size={16} /> 신규 작성
        </button>
      </div>
      {saved && (
        <div className="reservation-success" role="status">
          <strong>
            예약이 저장되었습니다.{" "}
            {saved.reference || `#${saved.reservation_id}`}
          </strong>
          <Link to="/express/reservations" onClick={onClose}>
            예약 목록 보기 →
          </Link>
        </div>
      )}
      {error && (
        <p className="error-panel" role="alert">
          {error}
        </p>
      )}
      {refreshError && (
        <p className="error-panel" role="alert">
          {refreshError}
        </p>
      )}
      <fieldset className="reservation-form-fields" disabled={busy || !!saved}>
        <div className="reservation-columns">
          <section className="reservation-card reservation-basics">
            <h3>
              <UserRound size={17} /> 예약 정보 <span>* 필수 항목</span>
            </h3>
            <div className="reservation-fields">
              <label>
                프로퍼티 *
                <input
                  readOnly
                  value={
                    data.properties.find((p) => p.property_id === propertyId)
                      ?.property_name ?? ""
                  }
                />
              </label>
              <label>
                고객명 *
                <input
                  required
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="고객 이름 입력"
                />
              </label>
              <div className="reservation-field-pair">
                <label>
                  입실일 *
                  <input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => {
                      const date = e.target.value;
                      setCheckIn(date);
                      clearAssignments();
                      if (date && checkOut <= date)
                        setCheckOut(addDays(date, 1));
                    }}
                  />
                </label>
                <label>
                  퇴실일 *
                  <input
                    type="date"
                    required
                    min={checkIn ? addDays(checkIn, 1) : undefined}
                    value={checkOut}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      clearAssignments();
                    }}
                  />
                </label>
              </div>
              <div className="reservation-room-summary">
                <div className="reservation-room-input-heading">
                  <strong>객실타입 · 객실수 *</strong>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setRoomDetailsOpen(true)}
                  >
                    자세히
                  </button>
                </div>
                <p>
                  {rooms.length
                    ? rooms
                        .map(
                          (r) =>
                            `${roomTypes.find((t) => t.room_type_id === r.room_type_id)?.room_type_name ?? "객실"} ${r.count}실`,
                        )
                        .join(" · ")
                    : "객실을 선택해 주세요."}
                </p>
              </div>
              <div className="reservation-stay">
                <CalendarDays size={16} />
                <strong>{nights > 0 ? `${nights}박` : "날짜 확인 필요"}</strong>
                <span>객실 {totalCount}실</span>
              </div>
              {!nights && (
                <p className="error-text" role="alert">
                  퇴실일은 입실일 이후로 선택하세요. 최소 1박입니다.
                </p>
              )}
              <div className="reservation-picker-field">
                <span>예약 거래처 *</span>
                <button
                  type="button"
                  className="reservation-picker-button"
                  aria-label="예약 거래처 선택"
                  onClick={() => setPicker("partner")}
                >
                  <span>
                    {selectedPartner
                      ? `${selectedPartner.partner_name} · ${selectedPartner.partner_type}`
                      : "거래처 검색 및 선택"}
                  </span>
                  <Search size={16} />
                </button>
              </div>
              <label>
                외부 예약번호
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="OTA / 여행사 예약번호 (선택)"
                />
              </label>
              <label>
                예약 상태
                <input value="예약" readOnly />
              </label>
              <label>
                메모
                <textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="고객 요청사항 및 예약 메모"
                />
              </label>
            </div>
          </section>
          <div className="reservation-details">
            <section className="reservation-card">
              <h3>
                <BedDouble size={17} /> 객실 구성
              </h3>
              <p className="reservation-hint">
                객실타입과 객실수는 필수이며, 호수 배정 없이도 예약을 저장할 수 있습니다.
                숙박일을 변경하면 호수 배정은 초기화됩니다.
              </p>
              {rooms.length ? (
                <div className="reservation-table-wrap">
                  <table className="reservation-input-table reservation-config-table">
                    <thead>
                      <tr>
                        <th>객실타입</th>
                        <th>객실 수</th>
                        <th>호수 배정</th>
                        <th>1박 요금</th>
                        <th>숙박일수</th>
                        <th>금액</th>
                        <th>
                          <span className="sr-only">삭제</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map((r) => {
                        const typeName =
                          roomTypes.find(
                            (t) => t.room_type_id === r.room_type_id,
                          )?.room_type_name ?? "객실타입 없음";
                        const rate = rateFor(r.room_type_id);
                        return (
                          <tr key={r.room_type_id}>
                            <td>
                              <strong>{typeName}</strong>
                            </td>
                            <td>{r.count}실</td>
                            <td>
                              <button
                                type="button"
                                className="button"
                                aria-label={`${typeName} 호수 배정`}
                                disabled={!nights}
                                onClick={() =>
                                  setAssignmentKey(
                                    allocations.find(
                                      (a) => a.type === String(r.room_type_id),
                                    )!.key,
                                  )
                                }
                              >
                                호수 배정 (
                                {r.room_ids?.filter(Boolean).length ?? 0}/
                                {r.count})
                              </button>
                              <small className="reservation-rate-name">
                                {r.room_ids?.filter(Boolean).length
                                  ? `${r.room_ids.filter(Boolean).length}실 배정 완료`
                                  : "미배정"}
                              </small>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="9999999999.99"
                                step="0.01"
                                aria-label={`${typeName} 1박 요금`}
                                placeholder="요금 입력"
                                required
                                value={r.nightly_rate ?? ""}
                                onChange={(e) =>
                                  setRooms((old) =>
                                    old.map((line) =>
                                      line.room_type_id === r.room_type_id
                                        ? {
                                            ...line,
                                            nightly_rate: e.target.value,
                                          }
                                        : line,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td>{nights ? `${nights}박` : "—"}</td>
                            <td className="reservation-number">
                              {rate && nights
                                ? money(
                                    (Math.round(rate.nightly_rate * 100) *
                                      r.count *
                                      nights) /
                                      100,
                                  )
                                : "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`${typeName} 객실 삭제`}
                                onClick={() =>
                                  setRooms((old) =>
                                    old.filter(
                                      (line) =>
                                        line.room_type_id !== r.room_type_id,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="reservation-empty">
                  <BedDouble size={27} />
                  <p>예약할 객실타입을 추가하세요.</p>
                  <span>
                    {roomTypes.length
                      ? "자세히에서 객실타입과 수량을 선택한 뒤 적용하세요."
                      : "이 프로퍼티에 등록된 객실타입이 없습니다."}
                  </span>
                </div>
              )}
              {rooms.length > 0 && !allRatesKnown && (
                <p className="reservation-hint">
                  객실타입별 1박 요금을 입력하세요. 무료 객실은 0원을
                  입력하세요.
                </p>
              )}
              {roomError && (
                <p className="error-text reservation-hint" role="alert">
                  {roomError}
                </p>
              )}
              <div className="reservation-subtotal">
                <span>
                  {rooms.length}개 타입 · {totalCount}실
                </span>
                <strong>
                  객실 합계{" "}
                  {roomTotal === null ? "요금 확인 필요" : money(roomTotal)}
                </strong>
              </div>
            </section>
            <section className="reservation-card">
              <h3>
                <ReceiptText size={17} /> 부대서비스
                <button
                  type="button"
                  className="button"
                  disabled={!services.length || charges.length >= 100}
                  onClick={() =>
                    setCharges((old) => [
                      ...old,
                      {
                        key: Math.max(-1, ...old.map((s) => s.key)) + 1,
                        item: String(services[0].charge_item_id),
                        date: checkIn,
                        quantity: "1",
                        price: String(services[0].default_price),
                      },
                    ])
                  }
                >
                  <Plus size={14} /> 부대서비스 추가
                </button>
              </h3>
              {charges.length ? (
                <div className="reservation-table-wrap">
                  <table className="reservation-input-table service-input-table">
                    <thead>
                      <tr>
                        <th>이용일 *</th>
                        <th>서비스 *</th>
                        <th>수량 *</th>
                        <th>단가 *</th>
                        <th>금액</th>
                        <th>
                          <span className="sr-only">삭제</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((s, i) => (
                        <tr key={s.key}>
                          <td>
                            <input
                              type="date"
                              required
                              min={checkIn}
                              max={checkOut}
                              aria-label={`서비스 ${i + 1} 이용일`}
                              value={s.date}
                              onChange={(e) =>
                                updateCharge(s.key, { date: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`서비스 ${i + 1} 항목`}
                              value={s.item}
                              onChange={(e) =>
                                updateCharge(s.key, {
                                  item: e.target.value,
                                  price: String(
                                    services.find(
                                      (item) =>
                                        item.charge_item_id ===
                                        Number(e.target.value),
                                    )?.default_price ?? 0,
                                  ),
                                })
                              }
                            >
                              {services.map((item) => (
                                <option
                                  key={item.charge_item_id}
                                  value={item.charge_item_id}
                                >
                                  {item.item_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max="2147483647"
                              step="1"
                              required
                              aria-label={`서비스 ${i + 1} 수량`}
                              value={s.quantity}
                              onChange={(e) =>
                                updateCharge(s.key, {
                                  quantity: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="9999999999.99"
                              step="0.01"
                              required
                              aria-label={`서비스 ${i + 1} 단가`}
                              value={s.price}
                              onChange={(e) =>
                                updateCharge(s.key, { price: e.target.value })
                              }
                            />
                          </td>
                          <td className="reservation-number">
                            {money(
                              (Math.round(Number(s.price || 0) * 100) *
                                Number(s.quantity || 0)) /
                                100,
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`서비스 ${i + 1} 삭제`}
                              onClick={() =>
                                setCharges((old) =>
                                  old.filter((line) => line.key !== s.key),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="reservation-hint">
                  {services.length
                    ? "필요한 부대서비스만 추가하세요."
                    : "등록된 부대서비스가 없습니다."}
                </p>
              )}
            </section>
            <section
              className="reservation-card reservation-price-summary"
              aria-label="요금 Summary"
            >
              <h3>요금 Summary</h3>
              <dl>
                <div>
                  <dt>객실 요금</dt>
                  <dd>
                    {roomTotal === null ? "요금 확인 필요" : money(roomTotal)}
                  </dd>
                </div>
                <div>
                  <dt>부대서비스</dt>
                  <dd>
                    {validServices
                      ? money(serviceTotal)
                      : "수량·단가 확인 필요"}
                  </dd>
                </div>
                <div className="reservation-grand-total">
                  <dt>총 예약금액</dt>
                  <dd>
                    {roomTotal === null || !validServices
                      ? "요금 확인 필요"
                      : money(
                          Math.round((roomTotal + serviceTotal) * 100) / 100,
                        )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </fieldset>
      <footer className="reservation-save-footer">
        <p>
          {!live
            ? "현재는 미리보기입니다. 실제 저장은 운영 화면에서 가능합니다."
            : saved
              ? "예약이 저장되었습니다."
              : !allRatesKnown
                ? "객실 구성과 1박 요금을 입력한 뒤 저장하세요."
                : `${totalCount}실 · ${nights}박 예약을 저장합니다.`}
        </p>
        <button
          type="submit"
          className="button primary"
          disabled={saveDisabled}
        >
          {busy ? "저장 중…" : saved ? "저장 완료" : "예약 저장"}
        </button>
      </footer>
      {roomDetailsOpen && (
        <RoomDetailsDialog
          roomTypes={roomTypes}
          rooms={rooms}
          onApply={setRooms}
          onClose={() => setRoomDetailsOpen(false)}
        />
      )}
      {assignmentKey !== null && (
        <RoomAssignmentDialog
          data={data}
          propertyId={propertyId}
          checkIn={checkIn}
          checkOut={checkOut}
          allocations={allocations}
          initialKey={assignmentKey}
          onApply={(assigned) =>
            setRooms((old) =>
              old.map((r) => ({
                ...r,
                room_ids: assigned
                  .filter((a) => a.type === String(r.room_type_id))
                  .map((a) => (a.room ? Number(a.room) : null)),
              })),
            )
          }
          onClose={() => setAssignmentKey(null)}
        />
      )}
      {picker && (
        <ReservationSelectDialog
          title="거래처 선택"
          searchLabel="거래처명 또는 타입 검색"
          selectedId={partnerId}
          options={data.partners.map((p) => ({
            id: p.partner_id,
            label: p.partner_name,
            detail: p.partner_type,
          }))}
          onSelect={setPartnerId}
          onClose={() => setPicker(null)}
        />
      )}
    </form>
  );
}
