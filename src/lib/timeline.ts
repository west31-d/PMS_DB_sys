import { addDays } from "./domain";
import type { ReservationRow } from "./types";
export function dateDistance(start: string, end: string) {
  return Math.round(
    (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) /
      86400000,
  );
}
export function nextMonth(day: string, offset = 1) {
  const d = new Date(day + "T00:00:00Z");
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + offset,
      Math.min(d.getUTCDate(), last),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function roomFloor(number: string) {
  return /^\d{3,}$/.test(number)
    ? String(Math.floor(Number(number) / 100)) + "F"
    : "기타";
}
export interface TimelineBooking {
  id: number;
  stayStatus?: string;
  reservation: ReservationRow;
}
export function placeBookings(
  bookings: TimelineBooking[],
  start: string,
  days: number,
) {
  const end = addDays(start, days),
    laneEnds: number[] = [];
  return bookings
    .filter(
      (b) =>
        b.reservation.status !== "취소" &&
        b.stayStatus !== "취소" &&
        b.reservation.check_in < b.reservation.check_out &&
        b.reservation.check_in < end &&
        b.reservation.check_out > start,
    )
    .map((b) => ({
      ...b,
      start: Math.max(0, dateDistance(start, b.reservation.check_in)),
      end: Math.min(days, dateDistance(start, b.reservation.check_out)),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id - b.id)
    .map((b) => {
      let lane = laneEnds.findIndex((e) => e <= b.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = b.end;
      return {
        ...b,
        lane,
        continuesBefore: b.reservation.check_in < start,
        continuesAfter: b.reservation.check_out > end,
      };
    });
}
