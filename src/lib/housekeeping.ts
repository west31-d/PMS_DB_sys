import { addDays, hotelDate } from "./domain";
import { stayStatus } from "./roomStatus";
import type { Dataset, Reservation, ReservationRoom, Room } from "./types";

export type HousekeepingData = Pick<
  Dataset,
  "rooms" | "reservations" | "reservationRooms" | "roomTypes"
>;
export interface Assignment {
  line: ReservationRoom;
  booking: Reservation;
  room: Room | undefined;
}
export function housekeepingAssignments(
  data: HousekeepingData,
  propertyId: number,
): Assignment[] {
  const bookings = new Map(
    data.reservations
      .filter(
        (r) =>
          r.property_id === propertyId &&
          ["예약", "재실", "퇴실"].includes(r.status),
      )
      .map((r) => [r.reservation_id, r]),
  );
  const rooms = new Map(
    data.rooms
      .filter((r) => r.property_id === propertyId)
      .map((r) => [r.room_id, r]),
  );
  return data.reservationRooms.flatMap((line) => {
    const booking = bookings.get(line.reservation_id);
    if (
      !booking ||
      !["예약", "재실", "퇴실"].includes(stayStatus(line, booking)) ||
      booking.check_in >= booking.check_out
    )
      return [];
    return [
      {
        line,
        booking,
        room: line.room_id === null ? undefined : rooms.get(line.room_id),
      },
    ];
  });
}
export function computeRoomState(
  room: Room,
  assignments: Assignment[],
  day: string,
  today = hotelDate(),
) {
  const related = assignments.filter((a) => a.room?.room_id === room.room_id);
  const relevant = related.filter(
    (a) => a.booking.check_in <= day && a.booking.check_out >= day,
  );
  const checkout = related.some(
    (a) => a.booking.check_in < day && a.booking.check_out === day,
  );
  const overnight = related.some(
    (a) => a.booking.check_in < day && a.booking.check_out >= day,
  );
  const checkIn = related.some((a) => a.booking.check_in === day);
  const warnings: string[] = [];
  if (room.is_out_of_order && relevant.length)
    warnings.push("고장 객실에 예약 배정이 있습니다.");
  if (relevant.some((a) => a.line.room_type_id !== room.room_type_id))
    warnings.push("예약 객실타입과 배정 객실타입이 다릅니다.");
  if (
    relevant.some((a, i) =>
      relevant
        .slice(i + 1)
        .some(
          (b) =>
            a.booking.check_in < b.booking.check_out &&
            b.booking.check_in < a.booking.check_out,
        ),
    )
  )
    warnings.push("동일 객실에 숙박 기간이 겹치는 배정이 있습니다.");
  if (day === today && checkIn && room.housekeeping_status === "미정비")
    warnings.push("당일 체크인 객실이 아직 미정비입니다.");
  const state = room.is_out_of_order
    ? "out_of_order"
    : day === today
      ? room.housekeeping_status === "미정비"
        ? "checkout_cleaning"
        : overnight && !checkout
          ? "stayover"
          : "vacant"
    : checkout
      ? "checkout_cleaning"
      : overnight
        ? "stayover"
        : "vacant";
  return {
    room,
    state,
    checkIn,
    warnings,
    reservationIds: [...new Set(relevant.map((a) => a.booking.reservation_id))],
  };
}

// Replace this adapter if explicit floor/display_order columns become available.
export function roomPosition(room: Room) {
  if (!/^\d+$/.test(room.room_number)) return null;
  const number = Number(room.room_number);
  if (!Number.isSafeInteger(number)) return null;
  const column = number % 100;
  return column >= 1 && column <= 6
    ? { floor: Math.floor(number / 100), column }
    : null;
}
export function buildRoomGrid(rooms: Room[]) {
  const floors = new Map<number, (Room | null)[]>();
  const extra: Room[] = [];
  for (const room of [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
  )) {
    const position = roomPosition(room);
    if (!position) {
      extra.push(room);
      continue;
    }
    const slots =
      floors.get(position.floor) ?? Array<Room | null>(6).fill(null);
    if (slots[position.column - 1]) extra.push(room);
    else slots[position.column - 1] = room;
    floors.set(position.floor, slots);
  }
  const result = [...floors.entries()]
    .sort(([a], [b]) => b - a)
    .map(([floor, slots]) => ({ label: `${floor}층`, slots }));
  for (let i = 0; i < extra.length; i += 6)
    result.push({
      label: `기타 ${i / 6 + 1}`,
      slots: Array.from({ length: 6 }, (_, j) => extra[i + j] ?? null),
    });
  return result;
}
export function validateRoomAssignments(
  assignments: Assignment[],
  day: string,
) {
  const group = (test: (r: Reservation) => boolean) => {
    const rows = assignments.filter((a) => test(a.booking));
    const assigned = rows.filter(
      (a) => a.room && a.room.room_type_id === a.line.room_type_id,
    ).length;
    return { total: rows.length, assigned, unassigned: rows.length - assigned };
  };
  return {
    arrivals: group((r) => r.check_in === day),
    departures: group((r) => r.check_in < day && r.check_out === day),
    overnight: group((r) => r.check_in < day && r.check_out >= day),
    staying: group((r) => r.check_in <= day && r.check_out > day),
  };
}
export function calculateDailyOccupancy(
  rooms: Room[],
  assignments: Assignment[],
  day: string,
) {
  const counts = validateRoomAssignments(assignments, day);
  const total = rooms.length;
  const broken = rooms.filter((r) => r.is_out_of_order).length;
  const sellable = total - broken;
  const occupied = counts.staying.total;
  return {
    day,
    total,
    broken,
    sellable,
    arrivals: counts.arrivals.total,
    departures: counts.departures.total,
    overnight: counts.overnight.total,
    occupied,
    available: sellable - occupied,
    occupancy: sellable ? (occupied / sellable) * 100 : null,
  };
}
export function monthDates(day: string) {
  const first = day.slice(0, 7) + "-01";
  const dates: string[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1))
    dates.push(d);
  return dates;
}
