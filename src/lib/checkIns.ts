import { stayStatus } from "./roomStatus";
import { reservationRows } from "./domain";
import { dateDistance } from "./timeline";
import type { Dataset } from "./types";
export interface CheckInFilters {
  from: string;
  to: string;
  customer: string;
  partnerId: string;
  roomTypeId: string;
  roomNumber: string;
  reference: string;
}
export function defaultCheckInFilters(day: string): CheckInFilters {
  return {
    from: day,
    to: day,
    customer: "",
    partnerId: "",
    roomTypeId: "",
    roomNumber: "",
    reference: "",
  };
}
export function checkInReport(
  data: Dataset,
  propertyId: number,
  filters: CheckInFilters,
  mode: "check_in" | "check_out" | "arrivals" = "check_in",
) {
  const dateField = mode === "check_out" ? "check_out" : "check_in";
  if (mode === "arrivals") {
    const bookings = new Map(data.reservations.map(r => [r.reservation_id, r]));
    data = { ...data, reservationRooms: data.reservationRooms.filter(line => {
      const booking = bookings.get(line.reservation_id);
      return booking && stayStatus(line, booking) === "예약";
    }) };
  }
  const includes = (text: string, query: string) =>
    text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return reservationRows(data, propertyId)
    .filter((r) => r[dateField] >= filters.from && r[dateField] <= filters.to)
    .filter(
      (r) =>
        includes(r.customer, filters.customer) &&
        (!filters.partnerId ||
          String(r.booking_partner_id) === filters.partnerId) &&
        includes(r.reference + " " + r.searchRefs, filters.reference),
    )
    .filter((r) =>
      data.reservationRooms.some(
        (rr) =>
          rr.reservation_id === r.reservation_id &&
          stayStatus(rr, r) === (mode === "check_out" ? "퇴실" : mode === "arrivals" ? "예약" : "재실") &&
          ((mode === "arrivals" && rr.room_id === null) || data.rooms.some(
            (room) =>
              room.room_id === rr.room_id && room.property_id === propertyId,
          )) &&
          (!filters.roomTypeId ||
            String(rr.room_type_id) === filters.roomTypeId) &&
          (!filters.roomNumber ||
            includes(
              data.rooms.find((room) => room.room_id === rr.room_id)
                ?.room_number ?? "",
              filters.roomNumber,
            )),
      ),
    )
    .map((r) => {
      const roomTypes = [
        ...new Set(
          data.reservationRooms
            .filter((rr) => rr.reservation_id === r.reservation_id)
            .map(
              (rr) =>
                data.roomTypes.find((t) => t.room_type_id === rr.room_type_id)
                  ?.room_type_name ?? "—",
            ),
        ),
      ].join(", ");
      const service = data.charges
        .filter((c) => c.reservation_id === r.reservation_id)
        .reduce((sum, c) => sum + c.quantity * Number(c.unit_price), 0);
      return {
        ...r,
        roomTypes: roomTypes || "—",
        nights: dateDistance(r.check_in, r.check_out),
        service,
        total: r.amount + service,
      };
    })
    .sort(
      (a, b) =>
        a[dateField].localeCompare(b[dateField]) ||
        a.roomLabel.localeCompare(b.roomLabel, undefined, { numeric: true }),
    );
}
export function reportCsv(rows: ReturnType<typeof checkInReport>) {
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      [
        "예약번호",
        "객실번호",
        "고객명",
        "입실일자",
        "퇴실일자",
        "박수",
        "객실타입",
        "객실료 합계",
        "서비스",
        "합계",
        "거래처",
        "상태",
      ],
      ...rows.map((r) => [
        r.reference,
        r.roomLabel,
        r.customer,
        r.check_in,
        r.check_out,
        r.nights,
        r.roomTypes,
        r.amount,
        r.service,
        r.total,
        r.partner,
        r.status,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
