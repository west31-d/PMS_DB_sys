import { describe, expect, it } from "vitest";
import { availabilityReport } from "./availability";
import { demoData } from "./demo";

function fixture() {
  const data = structuredClone(demoData);
  data.roomTypes = [data.roomTypes[0]];
  data.rooms = [
    { ...data.rooms[0], housekeeping_status: "미정비" as const },
    { ...data.rooms[0], room_id: 2, is_out_of_order: true },
  ];
  data.reservations = [
    {
      ...data.reservations[0],
      status: "재실",
      check_in: "2026-09-18",
      check_out: "2026-09-20",
    },
  ];
  data.reservationRooms = [
    {
      ...data.reservationRooms[0],
      room_id: null,
      stay_status: "예약",
      rate_amount: 0,
    },
  ];
  return data;
}
describe("날짜별 판매 재고", () => {
  it("미배정과 부분 입실을 포함하고 청소 상태와 관계없이 고장 객실만 판매 재고에서 제외한다", () => {
    const report = availabilityReport(fixture(), 1, "2026-09-17", 4);
    expect(report.total).toBe(2);
    expect(report.sellable).toBe(1);
    expect(report.broken).toBe(1);
    expect(report.totals.map((d) => d.available)).toEqual([1, 0, 0, 1]);
    expect(report.totals[1]).toEqual({
      available: 0,
      booked: 1,
      occupancy: 100,
      complimentary: 1,
    });
  });
  it("다른 호텔·취소·퇴실 객실은 차감하지 않는다", () => {
    const data = fixture();
    for (const status of ["취소", "퇴실"]) {
      data.reservationRooms[0].stay_status = status;
      expect(
        availabilityReport(data, 1, "2026-09-18", 1).totals[0].booked,
      ).toBe(0);
    }
    data.reservationRooms[0].stay_status = "재실";
    data.reservations[0].status = "취소";
    expect(availabilityReport(data, 1, "2026-09-18", 1).totals[0].booked).toBe(
      0,
    );
    data.reservations[0].status = "재실";
    data.reservations[0].property_id = 2;
    expect(availabilityReport(data, 1, "2026-09-18", 1).totals[0].booked).toBe(
      0,
    );
  });
  it("초과 예약은 음수, 판매 재고가 없으면 점유율은 미산정한다", () => {
    const data = fixture();
    data.reservationRooms.push({
      ...data.reservationRooms[0],
      reservation_room_id: 99,
      rate_amount: 100,
    });
    expect(availabilityReport(data, 1, "2026-09-18", 1).totals[0]).toEqual({
      available: -1,
      booked: 2,
      occupancy: 200,
      complimentary: 1,
    });
    data.rooms[0].is_out_of_order = true;
    expect(
      availabilityReport(data, 1, "2026-09-18", 1).totals[0].occupancy,
    ).toBeNull();
  });
  it("전체 점유율은 타입별 단순 평균이 아니라 전체 판매 객실수로 계산한다", () => {
    const data = fixture();
    data.roomTypes.push({
      ...data.roomTypes[0],
      room_type_id: 2,
      room_type_name: "STD",
    });
    for (let i = 3; i <= 5; i++)
      data.rooms.push({ ...data.rooms[0], room_id: i, room_type_id: 2 });
    const report = availabilityReport(data, 1, "2026-09-18", 1);
    expect(report.totals[0].occupancy).toBe(25);
  });
});
