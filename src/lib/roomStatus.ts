import type { Dataset, Reservation, ReservationRoom, Room } from "./types";

/** A terminal booking overrides its lines; otherwise each line owns its stay state. */
export function stayStatus(line: ReservationRoom, booking: Reservation) {
  if (booking.status === "취소" || booking.status === "퇴실")
    return booking.status;
  return line.stay_status ?? booking.status;
}

export function canCheckIn(
  line: ReservationRoom,
  booking: Reservation,
  today: string,
) {
  return (
    line.room_id !== null &&
    booking.check_in === today &&
    stayStatus(line, booking) === "예약"
  );
}

export function canCancelCheckIn(
  line: ReservationRoom,
  booking: Reservation,
  today: string,
) {
  return (
    line.room_id !== null &&
    booking.check_in === today &&
    stayStatus(line, booking) === "재실"
  );
}

export function isRoomOccupied(data: Dataset, room: Room) {
  return data.reservationRooms.some(
    (line) =>
      line.room_id === room.room_id &&
      data.reservations.some(
        (booking) =>
          booking.reservation_id === line.reservation_id &&
          booking.property_id === room.property_id &&
          stayStatus(line, booking) === "재실",
      ),
  );
}

/** Occupancy and cleaning are independent; this is only the compact UI summary. */
export function roomStatus(data: Dataset, room: Room) {
  if (room.is_out_of_order) return "고장";
  if (isRoomOccupied(data, room)) return "재실";
  if (room.housekeeping_status === "미정비") return "미정비";
  return "공실";
}
