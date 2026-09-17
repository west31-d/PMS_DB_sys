import { describe, expect, it } from "vitest";
import {
  pricedRooms,
  stayNights,
  reservationMoney,
} from "./reservationPricing";
import { loadPartnerRoomRates } from "./reservationRateSource";
const quotes = [
  { room_type_id: 1, rate_type_id: 1, nightly_rate: 80000 },
  { room_type_id: 2, rate_type_id: 1, nightly_rate: 100000 },
];
describe("객실타입 수량·요금 및 기존 DB 매핑", () => {
  it("배정 호수와 미배정 객실을 함께 저장 데이터에 유지한다", () => {
    expect(
      pricedRooms(
        [{ room_type_id: 1, count: 2, room_ids: [17, null] }],
        quotes,
        3,
      ),
    ).toEqual([
      { room_type_id: 1, room_id: 17, rate_amount: 240000 },
      { room_type_id: 1, room_id: null, rate_amount: 240000 },
    ]);
  });
  it("숙박일은 3박이며 잘못된 날짜와 당일 숙박은 거부한다", () => {
    expect(stayNights("2026-09-17", "2026-09-20")).toBe(3);
    expect(stayNights("2026-09-17", "2026-09-17")).toBe(0);
    expect(stayNights("2026-02-30", "2026-03-02")).toBe(0);
    expect(stayNights("", "2026-09-20")).toBe(0);
  });
  it("STT 2실 + STD 1실을 객실당 1행으로 확장하고 전체 숙박 요금을 보존한다", () => {
    const result = pricedRooms(
      [
        { room_type_id: 1, count: 2 },
        { room_type_id: 2, count: 1 },
      ],
      quotes,
      3,
    );
    expect(result).toEqual([
      { room_type_id: 1, room_id: null, rate_amount: 240000 },
      { room_type_id: 1, room_id: null, rate_amount: 240000 },
      { room_type_id: 2, room_id: null, rate_amount: 300000 },
    ]);
    expect(result.reduce((sum, r) => sum + r.rate_amount, 0)).toBe(780000);
    expect(reservationMoney(810000)).toBe("810,000원");
  });
  it("요금 미등록, 중복 요금, 잘못된 수량과 금액을 0원으로 대체하지 않는다", () => {
    const rooms = [{ room_type_id: 1, count: 1 }];
    expect(() => pricedRooms(rooms, [], 1)).toThrow("등록되어 있지");
    expect(() => pricedRooms(rooms, [quotes[0], quotes[0]], 1)).toThrow("중복");
    for (const count of [0, -1, 1.5, 101])
      expect(() =>
        pricedRooms([{ room_type_id: 1, count }], quotes, 1),
      ).toThrow();
    for (const nightly_rate of [-1, NaN, Infinity, 0.001, 10000000000])
      expect(() =>
        pricedRooms(rooms, [{ ...quotes[0], nightly_rate }], 1),
      ).toThrow();
    expect(
      pricedRooms(rooms, [{ ...quotes[0], nightly_rate: 0 }], 1)[0].rate_amount,
    ).toBe(0);
  });
  it("아직 없는 요금 저장 구조를 명시적으로 미연결 상태로 반환한다", async () => {
    await expect(
      loadPartnerRoomRates({
        propertyId: 1,
        partnerId: 1,
        roomTypeIds: [1],
        checkIn: "2026-09-17",
        checkOut: "2026-09-20",
      }),
    ).resolves.toEqual({ status: "not_configured", rates: [] });
  });
});
