import { describe, expect, it } from "vitest";
import { demoData } from "./demo";
import { reservationBalance } from "./checkOut";
describe("퇴실 잔액", () => {
  it("예약 전체 객실과 서비스에서 결제를 차감하고 다른 예약을 제외한다", () => {
    const data = structuredClone(demoData);
    data.reservationRooms.push({
      ...data.reservationRooms[0],
      reservation_room_id: 100,
      rate_amount: 120000,
    });
    const result = reservationBalance(data, 1001);
    expect(result.roomAmount).toBe(205000);
    expect(result.extraAmount).toBe(30000);
    expect(result.paid).toBe(85000);
    expect(result.balance).toBe(150000);
  });
  it("초과 결제를 음수 잔액으로 표시한다", () => {
    const data = structuredClone(demoData);
    data.payments[0].amount = 200000;
    expect(reservationBalance(data, 1001).balance).toBe(-85000);
  });
});
