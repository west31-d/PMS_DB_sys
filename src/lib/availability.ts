import { addDays } from "./domain";
import { stayStatus } from "./roomStatus";
import type { Dataset } from "./types";

export function availabilityReport(
  data: Dataset,
  propertyId: number,
  start: string,
  days: number,
) {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const bookings = new Map(
    data.reservations
      .filter((r) => r.property_id === propertyId)
      .map((r) => [r.reservation_id, r]),
  );
  const lines = data.reservationRooms.flatMap((line) => {
    const booking = bookings.get(line.reservation_id);
    return booking && ["예약", "재실"].includes(stayStatus(line, booking))
      ? [{ line, booking }]
      : [];
  });
  const types = data.roomTypes
    .filter((t) => t.property_id === propertyId)
    .map((type) => {
      const rooms = data.rooms.filter(
        (r) =>
          r.property_id === propertyId && r.room_type_id === type.room_type_id,
      );
      const broken = rooms.filter((r) => r.is_out_of_order).length;
      const sellable = rooms.length - broken;
      const entries = lines.filter(
        ({ line }) => line.room_type_id === type.room_type_id,
      );
      return {
        ...type,
        total: rooms.length,
        broken,
        sellable,
        days: dates.map((date) => {
          const occupied = entries.filter(
            ({ booking }) =>
              booking.check_in <= date && date < booking.check_out,
          );
          const booked = occupied.length;
          return {
            booked,
            available: sellable - booked,
            occupancy: sellable ? (booked / sellable) * 100 : null,
            complimentary: occupied.filter(
              ({ line }) => Number(line.rate_amount) === 0,
            ).length,
          };
        }),
      };
    });
  const total = types.reduce((sum, t) => sum + t.total, 0);
  const broken = types.reduce((sum, t) => sum + t.broken, 0);
  const sellable = total - broken;
  const totals = dates.map((_, i) => {
    const booked = types.reduce((sum, t) => sum + t.days[i].booked, 0);
    return {
      booked,
      available: sellable - booked,
      occupancy: sellable ? (booked / sellable) * 100 : null,
      complimentary: types.reduce((sum, t) => sum + t.days[i].complimentary, 0),
    };
  });
  return { dates, types, total, broken, sellable, totals };
}
