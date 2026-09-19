import type { Dataset } from "./types";

export function reservationBalance(data: Dataset, id: number) {
  const rooms = data.reservationRooms.filter((r) => r.reservation_id === id);
  const charges = data.charges.filter((r) => r.reservation_id === id);
  const payments = data.payments.filter((r) => r.reservation_id === id);
  const roomAmount = rooms.reduce(
    (sum, r) => sum + Math.round(Number(r.rate_amount) * 100),
    0,
  );
  const extraAmount = charges.reduce(
    (sum, r) => sum + Math.round(Number(r.unit_price) * 100) * r.quantity,
    0,
  );
  const paid = payments.reduce(
    (sum, r) => sum + Math.round(Number(r.amount) * 100),
    0,
  );
  return {
    rooms,
    charges,
    payments,
    roomAmount: roomAmount / 100,
    extraAmount: extraAmount / 100,
    paid: paid / 100,
    balance: (roomAmount + extraAmount - paid) / 100,
  };
}
