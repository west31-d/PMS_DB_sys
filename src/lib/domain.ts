import type { Dataset, ReservationRow } from "./types";
export function hotelDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const money = (value: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
export function reservationRows(
  data: Dataset,
  propertyId: number,
): ReservationRow[] {
  return data.reservations
    .filter((r) => r.property_id === propertyId)
    .map((r) => {
      const items = data.reservationRooms.filter(
        (x) => x.reservation_id === r.reservation_id,
      );
      const refs = data.refs.filter(
        (x) => x.reservation_id === r.reservation_id,
      );
      const partner = data.partners.find(
        (x) => x.partner_id === r.booking_partner_id,
      );
      return {
        ...r,
        customer:
          data.customers.find((x) => x.customer_id === r.customer_id)
            ?.customer_name ?? "고객 정보 없음",
        partner: partner?.partner_name ?? "직접 예약",
        partnerType: partner?.partner_type ?? "",
        reference: refs[0]?.ref_number ?? "#" + r.reservation_id,
        searchRefs: refs.map((x) => x.ref_number).join(" "),
        roomLabel:
          items
            .map(
              (x) =>
                data.rooms.find((room) => room.room_id === x.room_id)
                  ?.room_number ??
                (data.roomTypes.find((t) => t.room_type_id === x.room_type_id)
                  ?.room_type_name ?? "") + " 미배정",
            )
            .join(", ") || "객실 미등록",
        amount: items.reduce((sum, x) => sum + Number(x.rate_amount), 0),
      };
    });
}
export function matchesSearch(row: ReservationRow, search: string) {
  return [
    row.customer,
    row.reference,
    row.searchRefs,
    row.roomLabel,
    row.partner,
    String(row.reservation_id),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(search.trim().toLocaleLowerCase());
}
export function operationalRows(
  rows: ReservationRow[],
  mode: string,
  day: string,
) {
  if (mode === "arrivals")
    return rows.filter((r) => r.check_in === day && r.status === "예약");
  if (mode === "departures")
    return rows.filter((r) => r.check_out === day && r.status === "재실");
  if (mode === "in-house") return rows.filter((r) => r.status === "재실");
  if (mode === "ota") return rows.filter((r) => r.partnerType === "OTA");
  if (mode === "agency") return rows.filter((r) => r.partnerType === "TBA");
  return rows;
}
export function availableRooms(data: Dataset, propertyId: number, day: string) {
  const booked = new Set(
    data.reservationRooms
      .filter((rr) =>
        data.reservations.some(
          (r) =>
            r.reservation_id === rr.reservation_id &&
            r.property_id === propertyId &&
            ["예약", "재실"].includes(r.status) &&
            r.check_in <= day &&
            day < r.check_out,
        ),
      )
      .map((rr) => rr.room_id),
  );
  return data.rooms.filter(
    (r) =>
      r.property_id === propertyId &&
      !r.is_out_of_order &&
      r.housekeeping_status === "공실" &&
      !booked.has(r.room_id),
  );
}
