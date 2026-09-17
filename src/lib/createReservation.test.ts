import { describe, expect, it } from "vitest";
import {
  validateReservation,
  type ReservationInput,
} from "./createReservation";
const input: ReservationInput = {
  property_id: 1,
  customer_id: null,
  customer_name: "고객",
  booking_partner_id: 1,
  check_in: "2026-09-25",
  check_out: "2026-09-27",
  note: "",
  external_reference: "",
  rooms: [{ room_type_id: 1, room_id: 1, rate_amount: 160000 }],
  charges: [
    {
      charge_item_id: 1,
      quantity: 2,
      unit_price: 10000,
      service_date: "2026-09-26",
    },
  ],
};
describe("예약 입력 검증", () => {
  it("신규/기존 고객과 미배정 객실을 지원한다", () => {
    expect(validateReservation(input)).toBeNull();
    expect(
      validateReservation({
        ...input,
        customer_id: 3,
        customer_name: null,
        rooms: [{ ...input.rooms[0], room_id: null }],
      }),
    ).toBeNull();
  });
  it("공백 고객명과 잘못된 숙박 기간을 거부한다", () => {
    expect(
      validateReservation({ ...input, customer_name: "  " }),
    ).not.toBeNull();
    expect(
      validateReservation({ ...input, check_out: input.check_in }),
    ).not.toBeNull();
  });
  it("객실 중복 배정과 음수/비정상 요금을 거부한다", () => {
    expect(
      validateReservation({
        ...input,
        rooms: [input.rooms[0], input.rooms[0]],
      }),
    ).not.toBeNull();
    for (const rate_amount of [-1, NaN, Infinity, 0.001, 10000000000]) {
      expect(
        validateReservation({
          ...input,
          rooms: [{ ...input.rooms[0], rate_amount }],
        }),
      ).not.toBeNull();
    }
  });
  it("서비스 수량과 이용일을 검증한다", () => {
    expect(
      validateReservation({
        ...input,
        charges: [{ ...input.charges[0], quantity: 1.5 }],
      }),
    ).not.toBeNull();
    expect(
      validateReservation({
        ...input,
        charges: [{ ...input.charges[0], service_date: "2026-09-28" }],
      }),
    ).not.toBeNull();
    expect(
      validateReservation({
        ...input,
        charges: [{ ...input.charges[0], service_date: input.check_out }],
      }),
    ).toBeNull();
  });
});
