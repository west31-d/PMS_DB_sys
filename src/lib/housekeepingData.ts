import { supabase } from "./supabase";
import { monthDates, type HousekeepingData } from "./housekeeping";

export async function loadHousekeepingData(
  propertyId: number,
  businessDate: string,
): Promise<HousekeepingData> {
  if (!supabase) throw new Error("Supabase 연결이 필요합니다.");
  const client = supabase;
  const dates = monthDates(businessDate);
  async function read<T>(
    table: string,
    columns: string,
    order: string,
    joined = false,
  ) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = client
        .from(table)
        .select(columns)
        .eq(joined ? "reservation.property_id" : "property_id", propertyId);
      if (joined || table === "reservation") {
        const prefix = joined ? "reservation." : "";
        query = query
          .lte(prefix + "check_in", dates[dates.length - 1])
          .gte(prefix + "check_out", dates[0]);
      }
      const { data, error } = await query
        .order(order)
        .range(offset, offset + 999);
      if (error) throw new Error("청소표 조회 실패: " + error.message);
      rows.push(...(data as unknown as T[]));
      if (data.length < 1000) return rows;
    }
  }
  const [rooms, reservations, reservationRooms, roomTypes] = await Promise.all([
    read<HousekeepingData["rooms"][number]>(
      "room",
      "room_id,property_id,room_type_id,room_number,housekeeping_status,is_out_of_order",
      "room_id",
    ),
    read<HousekeepingData["reservations"][number]>(
      "reservation",
      "reservation_id,property_id,customer_id,booking_partner_id,check_in,check_out,status,note",
      "reservation_id",
    ),
    read<HousekeepingData["reservationRooms"][number]>(
      "reservation_room",
      "reservation_room_id,reservation_id,room_type_id,room_id,rate_amount,stay_status,reservation!inner(property_id,check_in,check_out)",
      "reservation_room_id",
      true,
    ),
    read<HousekeepingData["roomTypes"][number]>(
      "room_type",
      "room_type_id,property_id,room_type_name",
      "room_type_id",
    ),
  ]);
  return { rooms, reservations, reservationRooms, roomTypes };
}
