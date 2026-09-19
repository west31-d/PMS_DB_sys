import { describe, expect, it } from "vitest";
import { demoData } from "./demo";
import {
  buildRoomGrid,
  calculateDailyOccupancy,
  computeRoomState,
  housekeepingAssignments,
  monthDates,
  validateRoomAssignments,
} from "./housekeeping";

function fixture() {
  const data = structuredClone(demoData);
  data.reservations = [
    {
      ...data.reservations[0],
      reservation_id: 1,
      check_in: "2026-09-18",
      check_out: "2026-09-21",
    },
    {
      ...data.reservations[0],
      reservation_id: 2,
      check_in: "2026-09-18",
      check_out: "2026-09-19",
    },
    {
      ...data.reservations[0],
      reservation_id: 3,
      check_in: "2026-09-19",
      check_out: "2026-09-21",
    },
  ].map((r) => ({ ...r, status: "예약" }));
  data.reservationRooms = [
    {
      ...data.reservationRooms[0],
      reservation_room_id: 1,
      reservation_id: 1,
      room_id: 1,
      room_type_id: 1,
      stay_status: "예약",
    },
    {
      ...data.reservationRooms[0],
      reservation_room_id: 2,
      reservation_id: 2,
      room_id: 2,
      room_type_id: 2,
      stay_status: "퇴실",
    },
    {
      ...data.reservationRooms[0],
      reservation_room_id: 3,
      reservation_id: 3,
      room_id: 2,
      room_type_id: 2,
      stay_status: "예약",
    },
    {
      ...data.reservationRooms[0],
      reservation_room_id: 4,
      reservation_id: 3,
      room_id: null,
      room_type_id: 2,
      stay_status: "예약",
    },
  ];
  return data;
}
describe("청소표 영업일 계산", () => {
  it("오늘 퇴실 객실은 정비완료이면 공실, 미정비이면 청소 대상으로 표시한다", () => {
    const data = fixture();
    const assignments = housekeepingAssignments(data, 1);
    expect(computeRoomState(data.rooms[1], assignments, "2026-09-19", "2026-09-19")).toMatchObject({ state: "vacant", checkIn: true });
    data.rooms[1].housekeeping_status = "미정비";
    expect(computeRoomState(data.rooms[1], assignments, "2026-09-19", "2026-09-19").state).toBe("checkout_cleaning");
  });
  it("재실, 당일 퇴실, 체크인, turnover, 공실을 독립 계산한다", () => {
    const data = fixture();
    const assignments = housekeepingAssignments(data, 1);
    expect(
      computeRoomState(data.rooms[0], assignments, "2026-09-19", "2026-10-01").state,
    ).toBe("stayover");
    const turnover = computeRoomState(data.rooms[1], assignments, "2026-09-19", "2026-10-01");
    expect(turnover.state).toBe("checkout_cleaning");
    expect(turnover.checkIn).toBe(true);
    expect(turnover.warnings).toHaveLength(0);
    expect(
      computeRoomState(data.rooms[2], assignments, "2026-09-19").state,
    ).toBe("vacant");
    expect(
      computeRoomState(data.rooms[0], assignments, "2026-09-18"),
    ).toMatchObject({ state: "vacant", checkIn: true });
    expect(
      computeRoomState(data.rooms[0], assignments, "2026-09-21", "2026-10-01").state,
    ).toBe("checkout_cleaning");
    expect(
      computeRoomState(data.rooms[0], assignments, "2026-09-22").state,
    ).toBe("vacant");
  });
  it("미배정 예약도 일별 수량에 포함하고 취소·다른 호텔은 제외한다", () => {
    const data = fixture();
    const assignments = housekeepingAssignments(data, 1);
    expect(validateRoomAssignments(assignments, "2026-09-19").arrivals).toEqual(
      { total: 2, assigned: 1, unassigned: 1 },
    );
    expect(
      calculateDailyOccupancy(data.rooms, assignments, "2026-09-19"),
    ).toMatchObject({
      total: 24,
      broken: 2,
      sellable: 22,
      arrivals: 2,
      departures: 1,
      overnight: 2,
      occupied: 3,
      available: 19,
    });
    data.reservations[2].status = "취소";
    expect(
      validateRoomAssignments(housekeepingAssignments(data, 1), "2026-09-19")
        .arrivals.total,
    ).toBe(0);
    expect(housekeepingAssignments(data, 99)).toHaveLength(0);
  });
  it("고장을 우선 표시하고 중복 배정·미정비 체크인을 경고한다", () => {
    const data = fixture();
    data.rooms[1].is_out_of_order = true;
    data.rooms[1].housekeeping_status = "미정비";
    data.reservationRooms[3].room_id = 2;
    const state = computeRoomState(
      data.rooms[1],
      housekeepingAssignments(data, 1),
      "2026-09-19",
      "2026-09-19",
    );
    expect(state.state).toBe("out_of_order");
    expect(state.warnings).toHaveLength(3);
    expect(state.checkIn).toBe(true);
    expect(calculateDailyOccupancy([], [], "2026-09-19").occupancy).toBeNull();
  });
  it("층 내 빈 슬롯을 유지하고 모든 비표준 객실도 빠짐없이 배치한다", () => {
    const rooms = ["205", "1502", "1506", "701", "VIP", "1507"].map(
      (room_number, i) => ({
        ...demoData.rooms[0],
        room_id: i + 1,
        room_number,
      }),
    );
    const grid = buildRoomGrid(rooms);
    expect(grid[0].label).toBe("15층");
    expect(grid[0].slots[0]).toBeNull();
    expect(grid[0].slots[1]?.room_number).toBe("1502");
    expect(grid.flatMap((g) => g.slots).filter(Boolean)).toHaveLength(6);
    expect(grid.every((g) => g.slots.length === 6)).toBe(true);
    expect(monthDates("2028-02-19")).toHaveLength(29);
  });
});
