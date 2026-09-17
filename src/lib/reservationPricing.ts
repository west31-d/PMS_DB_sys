import type { ReservationInput } from "./createReservation";

export interface RoomConfiguration {
  room_type_id: number;
  count: number;
  nightly_rate?: string;
  room_ids?: (number | null)[];
}
export interface RoomRateQuote {
  room_type_id: number;
  rate_type_id?: number;
  nightly_rate: number;
}
export const reservationMoney = (amount: number) =>
  `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(amount)}원`;
export function stayNights(checkIn: string, checkOut: string): number {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(checkIn) || !validDate(checkOut)) return 0;
  return Math.max(
    0,
    Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000),
  );
}
export function pricedRooms(
  configurations: RoomConfiguration[],
  quotes: RoomRateQuote[],
  nights: number,
): ReservationInput["rooms"] {
  if (!Number.isInteger(nights) || nights < 1)
    throw new Error("퇴실일은 입실일 이후로 선택하세요.");
  if (!configurations.length)
    throw new Error("객실타입을 하나 이상 추가하세요.");
  const totalCount = configurations.reduce((sum, r) => sum + r.count, 0);
  if (
    !Number.isInteger(totalCount) ||
    totalCount > 100 ||
    configurations.some((r) => !Number.isInteger(r.count) || r.count < 1)
  )
    throw new Error("객실 수는 1실 이상, 전체 100실 이하의 정수로 입력하세요.");
  return configurations.flatMap((line) => {
    const matches = quotes.filter((q) => q.room_type_id === line.room_type_id);
    if (matches.length !== 1)
      throw new Error(
        "거래처별 객실요금이 등록되어 있지 않거나 여러 요금이 중복되어 있습니다.",
      );
    const rate = matches[0];
    if (
      !Number.isFinite(rate.nightly_rate) ||
      rate.nightly_rate < 0 ||
      Math.abs(rate.nightly_rate * 100 - Math.round(rate.nightly_rate * 100)) >
        0.0001
    )
      throw new Error("객실요금 정보를 확인하세요.");
    const rateAmount = (Math.round(rate.nightly_rate * 100) * nights) / 100;
    if (rateAmount > 9999999999.99)
      throw new Error("객실당 숙박 금액이 저장 가능한 범위를 초과했습니다.");
    // The existing schema stores one row per room, not one row per room type.
    return Array.from({ length: line.count }, (_, index) => ({
      room_type_id: line.room_type_id,
      room_id: line.room_ids?.[index] ?? null,
      rate_amount: rateAmount,
    }));
  });
}
