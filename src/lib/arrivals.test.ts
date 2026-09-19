import { expect, it } from "vitest";
import { demoData } from "./demo";
import { checkInReport, defaultCheckInFilters } from "./checkIns";
import { hotelDate } from "./domain";
it("당일 입실 전 객실과 미배정을 포함하고 재실·퇴실·취소는 제외한다", () => {
  const data = structuredClone(demoData);
  const filters = defaultCheckInFilters(hotelDate());
  expect(checkInReport(data, 1, filters, "arrivals")).toHaveLength(4);
  data.reservations[4].status = "재실";
  data.reservationRooms[4].stay_status = "재실";
  data.reservationRooms.push({ ...data.reservationRooms[4], reservation_room_id: 99, room_id: null, stay_status: "예약" });
  data.reservations[5].status = "취소";
  data.reservations[6].status = "퇴실";
  const result = checkInReport(data, 1, filters, "arrivals");
  expect(result.map(r => r.reservation_id)).toEqual([1005,1008]);
  expect(result[0].roomLabel).toContain("미배정");
  expect(result[0].roomLabel).not.toContain("305");
});
