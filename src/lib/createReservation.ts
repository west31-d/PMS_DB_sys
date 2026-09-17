import { supabase } from "./supabase";
import { stayNights } from "./reservationPricing";

export interface ReservationInput {
  property_id: number;
  customer_id: number | null;
  customer_name: string | null;
  booking_partner_id: number | null;
  check_in: string;
  check_out: string;
  note: string;
  external_reference: string;
  rooms: {
    room_type_id: number;
    room_id: number | null;
    rate_amount: number;
  }[];
  charges: {
    charge_item_id: number;
    service_date: string;
    quantity: number;
    unit_price: number;
  }[];
}
export interface SavedReservation {
  reservation_id: number;
  reference: string;
}

export function validateReservation(input: ReservationInput): string | null {
  if (!Number.isSafeInteger(input.property_id) || input.property_id <= 0)
    return "프로퍼티를 선택하세요.";
  if (
    !input.booking_partner_id ||
    !Number.isSafeInteger(input.booking_partner_id) ||
    input.booking_partner_id <= 0
  )
    return "예약 거래처를 선택하세요.";
  if (!input.customer_id && !input.customer_name?.trim())
    return "고객명을 입력하세요.";
  if (stayNights(input.check_in, input.check_out) < 1)
    return "퇴실일은 입실일 이후로 선택하세요.";
  if (input.rooms.length < 1 || input.rooms.length > 100)
    return "객실은 1~100실 입력하세요.";
  const validAmount = (value: number) =>
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 9999999999.99 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.0001;
  if (input.rooms.some((r) => !r.room_type_id || !validAmount(r.rate_amount)))
    return "객실타입과 올바른 객실 요금을 입력하세요.";
  const assigned = input.rooms.flatMap((r) => (r.room_id ? [r.room_id] : []));
  if (new Set(assigned).size !== assigned.length)
    return "같은 객실을 중복 배정할 수 없습니다.";
  if (input.charges.length > 100) return "서비스는 최대 100건까지 입력하세요.";
  if (
    input.charges.some(
      (s) =>
        !s.charge_item_id ||
        !Number.isInteger(s.quantity) ||
        s.quantity <= 0 ||
        !validAmount(s.unit_price),
    )
  )
    return "서비스 항목, 수량 및 단가를 확인하세요.";
  if (
    input.charges.some(
      (s) =>
        !s.service_date ||
        s.service_date < input.check_in ||
        s.service_date > input.check_out,
    )
  )
    return "서비스 이용일은 숙박 기간 내에서 선택하세요.";
  return null;
}

export async function createReservation(
  requestId: string,
  input: ReservationInput,
): Promise<SavedReservation> {
  const invalid = validateReservation(input);
  if (invalid) throw new Error(invalid);
  if (!supabase)
    throw new Error("운영 서버 연결 후 예약을 저장할 수 있습니다.");
  const { data, error } = await supabase.rpc("pms_create_reservation", {
    p_request_id: requestId,
    p_payload: input,
  });
  if (error) {
    console.error("예약 저장 Supabase 오류", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "23503")
      throw new Error(
        "고객·거래처·객실타입 또는 서비스 정보를 찾을 수 없습니다. 새로고침 후 다시 선택하세요.",
      );
    if (error.code === "42501")
      throw new Error("이 프로퍼티의 예약 저장 권한이 없습니다.");
    if (error.code === "23514")
      throw new Error("예약 날짜, 객실 금액 또는 서비스 수량을 확인하세요.");
    throw new Error(error.message);
  }
  if (!data?.reservation_id)
    throw new Error(
      "저장 응답을 확인하지 못했습니다. 다시 저장하면 동일한 요청을 확인합니다.",
    );
  return data as SavedReservation;
}
