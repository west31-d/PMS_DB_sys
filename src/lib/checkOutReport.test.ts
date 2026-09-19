import { describe, expect, it } from "vitest";
import { demoData } from "./demo";
import { checkInReport, defaultCheckInFilters } from "./checkIns";

describe("실 퇴실 목록", () => {
  it("체크아웃 날짜의 양끝을 포함하고 재실·취소 예약을 제외한다", () => {
    const data = structuredClone(demoData);
    data.reservations.forEach((r, i) => {
      r.check_in = "2026-09-01";
      r.check_out = i === 0 ? "2026-09-19" : "2026-09-20";
    });
    data.reservationRooms[0].stay_status = "퇴실";
    data.reservationRooms[1].stay_status = "퇴실";
    data.reservations[2].status = "취소";
    data.reservationRooms[2].stay_status = "퇴실";
    const filters = defaultCheckInFilters("2026-09-19");
    expect(checkInReport(data, 1, filters, "check_out").map(r => r.reservation_id)).toEqual([1001]);
    expect(checkInReport(data, 1, { ...filters, to: "2026-09-20" }, "check_out").map(r => r.reservation_id)).toEqual([1001, 1002]);
    expect(checkInReport(data, 1, filters)).toHaveLength(0);
  });
  it("일부 퇴실 예약도 포함하되 객실 조건은 퇴실한 객실에만 적용한다", () => {
    const data = structuredClone(demoData);
    data.reservationRooms[1].reservation_id = 1001;
    data.reservationRooms[0].stay_status = "퇴실";
    const filters = defaultCheckInFilters(data.reservations[0].check_out);
    expect(checkInReport(data, 1, { ...filters, roomNumber: "301" }, "check_out")).toHaveLength(1);
    expect(checkInReport(data, 1, { ...filters, roomNumber: "302" }, "check_out")).toHaveLength(0);
    expect(checkInReport(data, 2, filters, "check_out")).toHaveLength(0);
  });
});
