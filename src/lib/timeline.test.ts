import { describe, expect, it } from "vitest";
import { placeBookings, nextMonth, roomFloor } from "./timeline";
import { reservationRows } from "./domain";
import { demoData } from "./demo";
const base = reservationRows(demoData, 1)[0];
const booking = (id: number, start: string, end: string, status = "예약") => ({
  id,
  reservation: { ...base, check_in: start, check_out: end, status },
});
describe("객실 현황표", () => {
  it("표시 기간으로 자르고 체크아웃 당일은 제외한다", () => {
    const placed = placeBookings(
      [
        booking(1, "2026-09-14", "2026-10-10"),
        booking(2, "2026-09-15", "2026-09-16"),
        booking(3, "2026-09-30", "2026-10-01"),
        booking(4, "2026-09-17", "2026-09-19", "취소"),
      ],
      "2026-09-16",
      14,
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      start: 0,
      end: 14,
      continuesBefore: true,
      continuesAfter: true,
    });
  });
  it("연속 예약은 같은 줄에, 중복 예약은 다른 줄에 놓는다", () => {
    const placed = placeBookings(
      [
        booking(1, "2026-09-16", "2026-09-18"),
        booking(2, "2026-09-18", "2026-09-20"),
        booking(3, "2026-09-17", "2026-09-19"),
      ],
      "2026-09-16",
      14,
    );
    expect(placed.find((x) => x.id === 1)?.lane).toBe(0);
    expect(placed.find((x) => x.id === 2)?.lane).toBe(0);
    expect(placed.find((x) => x.id === 3)?.lane).toBe(1);
  });
  it("월말과 윤년의 한 달 범위를 계산한다", () => {
    expect(nextMonth("2026-01-31")).toBe("2026-02-28");
    expect(nextMonth("2028-01-31")).toBe("2028-02-29");
    expect(nextMonth("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("선행 0 객실번호도 층을 계산하고 비숫자는 기타로 표시한다", () => {
    expect(roomFloor("0204")).toBe("2F");
    expect(roomFloor("1206")).toBe("12F");
    expect(roomFloor("A-1")).toBe("기타");
  });
});
