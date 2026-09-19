import { describe, expect, it } from "vitest";
import { demoData } from "./demo";
import { availableRooms, operationalRows, reservationRows } from "./domain";
import {
  isRoomOccupied,
  roomStatus,
  canCancelCheckIn,
  canCheckIn,
} from "./roomStatus";
import { checkInReport, defaultCheckInFilters } from "./checkIns";

describe("숙박 상태와 청소 상태 분리", () => {
  it("입실은 한국 날짜 기준 당일의 배정된 예약 객실만 허용한다", () => {
    const booking = {
      ...demoData.reservations[0],
      check_in: "2026-09-18",
      status: "예약",
    };
    const line = { ...demoData.reservationRooms[0], stay_status: "예약" };
    expect(canCheckIn(line, booking, "2026-09-18")).toBe(true);
    expect(canCheckIn(line, booking, "2026-09-17")).toBe(false);
    expect(canCheckIn(line, booking, "2026-09-19")).toBe(false);
    expect(canCheckIn({ ...line, room_id: null }, booking, "2026-09-18")).toBe(
      false,
    );
    expect(canCheckIn(line, { ...booking, status: "취소" }, "2026-09-18")).toBe(
      false,
    );
  });
  it("입실 취소는 당일 재실 객실만 허용한다", () => {
    const booking = {
      ...demoData.reservations[0],
      check_in: "2026-09-18",
      status: "재실",
    };
    const line = { ...demoData.reservationRooms[0], stay_status: "재실" };
    expect(canCancelCheckIn(line, booking, "2026-09-18")).toBe(true);
    expect(canCancelCheckIn(line, booking, "2026-09-19")).toBe(false);
    expect(canCancelCheckIn(line, booking, "2026-09-17")).toBe(false);
    expect(
      canCancelCheckIn({ ...line, stay_status: "예약" }, booking, "2026-09-18"),
    ).toBe(false);
    expect(
      canCancelCheckIn(line, { ...booking, status: "퇴실" }, "2026-09-18"),
    ).toBe(false);
  });
  it("일부 입실 예약의 남은 객실은 입실 예정으로 남는다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].check_in = "2026-09-17";
    data.reservationRooms.push({
      ...data.reservationRooms[0],
      reservation_room_id: 90,
      room_id: 20,
      stay_status: "예약",
    });
    const rows = reservationRows(data, 1);
    expect(
      operationalRows(rows, "arrivals", "2026-09-17").some(
        (r) => r.reservation_id === 1001,
      ),
    ).toBe(true);
    expect(rows[0].roomStayStatuses).toEqual(["재실", "예약"]);
    expect(isRoomOccupied(data, data.rooms[19])).toBe(false);
  });
  it("재실 중 미정비를 표현하고 예정 퇴실일이 지나도 실제 퇴실 전에는 공실로 판매하지 않는다", () => {
    const data = structuredClone(demoData);
    const room = data.rooms[0];
    room.housekeeping_status = "미정비";
    expect(roomStatus(data, room)).toBe("재실");
    expect(room.housekeeping_status).toBe("미정비");
    room.housekeeping_status = "정비완료";
    expect(
      availableRooms(data, 1, "2099-01-01").some(
        (r) => r.room_id === room.room_id,
      ),
    ).toBe(false);
  });
  it("같은 방의 다른 예약이 입실해도 이전 예약을 재실로 조회하지 않는다", () => {
    const data = structuredClone(demoData);
    data.reservations[0].check_in = "2026-09-17";
    data.reservationRooms[0].stay_status = "퇴실";
    data.reservationRooms[1].room_id = data.rooms[0].room_id;
    expect(isRoomOccupied(data, data.rooms[0])).toBe(true);
    expect(
      checkInReport(data, 1, defaultCheckInFilters("2026-09-17")).some(
        (r) => r.reservation_id === 1001,
      ),
    ).toBe(false);
  });
  it("객실 하나만 취소한 경우 그 객실의 재고는 해제한다", () => {
    const data = structuredClone(demoData);
    data.reservationRooms[0].stay_status = "취소";
    expect(
      availableRooms(data, 1, data.reservations[0].check_in).some(
        (r) => r.room_id === data.rooms[0].room_id,
      ),
    ).toBe(true);
  });
});
