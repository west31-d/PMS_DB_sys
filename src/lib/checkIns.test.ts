import { describe, expect, it } from "vitest";
import { checkInReport, defaultCheckInFilters, reportCsv } from "./checkIns";
import { demoData } from "./demo";
describe("실 입실 조회", () => {
  it("청소 상태 대신 객실별 숙박 상태로 입실을 판단하고 퇴실 예약은 제외한다", () => {
    const data = structuredClone(demoData);
    data.reservations = data.reservations.slice(0, 4).map((r, i) => ({
      ...r,
      check_in: i === 3 ? "2026-09-15" : "2026-09-16",
      check_out: "2026-09-18",
      status: ["재실", "예약", "퇴실", "재실"][i],
    }));
    data.reservationRooms[0].stay_status = "예약";
    data.reservationRooms[1].stay_status = "재실";
    data.rooms[0].housekeeping_status = "정비완료";
    data.rooms[1].housekeeping_status = "미정비";
    data.rooms[2].housekeeping_status = "미정비";
    expect(
      checkInReport(data, 1, defaultCheckInFilters("2026-09-16")).map(
        (r) => r.reservation_id,
      ),
    ).toEqual([1002]);
  });
  it("미배정 객실과 다른 방의 재실 상태는 조회 근거로 사용하지 않는다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].check_in = "2026-09-16";
    data.reservationRooms[0].room_id = null;
    expect(
      checkInReport(data, 1, defaultCheckInFilters("2026-09-16")).some(
        (r) => r.reservation_id === 1001,
      ),
    ).toBe(false);
  });
  it("날짜 범위 양끝을 포함하며 호텔·거래처·타입·고객명으로 좁힌다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].check_in = "2026-09-14";
    data.reservations[1].check_in = "2026-09-16";
    data.reservations[2].property_id = 2;
    data.reservations[3].check_in = "2026-09-17";
    const filters = {
      ...defaultCheckInFilters("2026-09-14"),
      to: "2026-09-16",
    };
    expect(checkInReport(data, 1, filters)).toHaveLength(2);
    expect(
      checkInReport(data, 1, {
        ...filters,
        customer: "김하늘",
        partnerId: "1",
        roomTypeId: "1",
        roomNumber: "301",
      }),
    ).toHaveLength(1);
    expect(
      checkInReport(data, 1, {
        ...filters,
        customer: "김하늘",
        roomTypeId: "2",
      }),
    ).toHaveLength(0);
  });
  it("복수 객실의 서비스는 한 번만 합산하고 CSV 수식을 이스케이프한다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].check_in = "2026-09-16";
    data.reservationRooms.push({
      ...data.reservationRooms[0],
      reservation_room_id: 99,
      room_id: 10,
      rate_amount: 50000,
    });
    data.customers[0].customer_name = "=SUM(1,2)";
    const row = checkInReport(
      data,
      1,
      defaultCheckInFilters("2026-09-16"),
    ).find((r) => r.reservation_id === 1001)!;
    expect(row.amount).toBe(135000);
    expect(row.service).toBe(30000);
    expect(row.total).toBe(165000);
    expect(reportCsv([row])).toContain("'=SUM(1,2)");
  });
});
