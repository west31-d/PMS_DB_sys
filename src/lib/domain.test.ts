import { describe, expect, it } from "vitest";
import {
  addDays,
  availableRooms,
  hotelDate,
  matchesSearch,
  operationalRows,
  reservationRows,
} from "./domain";
import { demoData } from "./demo";
describe("호텔 운영 조회", () => {
  it("한국 시간 자정과 월 경계를 처리한다", () => {
    expect(hotelDate(new Date("2026-09-14T15:00:00Z"))).toBe("2026-09-15");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
  it("퇴실 날짜는 객실 예약 점유에서 제외한다", () => {
    const data = structuredClone(demoData);
    data.rooms = [
      {
        room_id: 1,
        property_id: 1,
        room_type_id: 1,
        room_number: "301",
        housekeeping_status: "정비완료",
        is_out_of_order: false,
      },
    ];
    data.reservations = [
      {
        reservation_id: 1,
        property_id: 1,
        customer_id: 1,
        booking_partner_id: null,
        check_in: "2026-09-14",
        check_out: "2026-09-15",
        status: "예약",
        note: null,
      },
    ];
    data.reservationRooms = [
      {
        reservation_room_id: 1,
        reservation_id: 1,
        room_type_id: 1,
        room_id: 1,
        rate_amount: 85000,
      },
    ];
    expect(availableRooms(data, 1, "2026-09-14")).toHaveLength(0);
    expect(availableRooms(data, 1, "2026-09-15")).toHaveLength(1);
    data.rooms[0].is_out_of_order = true;
    expect(availableRooms(data, 1, "2026-09-15")).toHaveLength(0);
  });
  it("다른 호텔 예약과 취소된 입실 예정은 제외한다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].property_id = 2;
    const rows = reservationRows(data, 1);
    expect(
      rows.some(
        (r) => r.reservation_id === data.reservations[0].reservation_id,
      ),
    ).toBe(false);
    const row = { ...rows[0], check_in: "2026-09-15", status: "취소" };
    expect(operationalRows([row], "arrivals", "2026-09-15")).toEqual([]);
  });
  it("표시되지 않은 추가 예약번호도 검색한다", () => {
    const data = structuredClone(demoData);
    data.refs.push({
      reservation_id: 1001,
      ref_type: "OTA",
      ref_number: "SECOND-999",
    });
    const row = reservationRows(data, 1)[0];
    expect(matchesSearch(row, "second-999")).toBe(true);
    expect(matchesSearch(row, "not-found")).toBe(false);
  });
});
