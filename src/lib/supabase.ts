import { createClient } from "@supabase/supabase-js";
import type { Dataset } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export interface CheckInQuery {
  propertyId: number;
  from: string;
  to: string;
  dateField?: "check_in" | "check_out";
}
async function readRows<T>(
  table: string,
  columns: string,
  order: string,
  checkIn?: CheckInQuery,
): Promise<T[]> {
  if (!supabase) throw new Error("Supabase 연결 설정이 없습니다.");
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns);
    if (checkIn)
      query = query
        .eq("property_id", checkIn.propertyId)
        .gte(checkIn.dateField ?? "check_in", checkIn.from)
        .lte(checkIn.dateField ?? "check_in", checkIn.to);
    for (const column of order.split(",")) query = query.order(column);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(table + ": " + error.message);
    result.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
  }
  return result;
}
export async function loadDataset(checkIn?: CheckInQuery): Promise<Dataset> {
  const [
    properties,
    customers,
    partners,
    roomTypes,
    rooms,
    reservations,
    reservationRooms,
    refs,
    payments,
    charges,
    chargeItems,
    rateTypes,
  ] = await Promise.all([
    readRows<Dataset["properties"][number]>(
      "property",
      "property_id,property_name",
      "property_id",
    ),
    readRows<Dataset["customers"][number]>(
      "customer",
      "customer_id,customer_name",
      "customer_id",
    ),
    readRows<Dataset["partners"][number]>(
      "partner",
      "partner_id,partner_name,partner_type",
      "partner_id",
    ),
    readRows<Dataset["roomTypes"][number]>(
      "room_type",
      "room_type_id,property_id,room_type_name",
      "room_type_id",
    ),
    readRows<Dataset["rooms"][number]>(
      "room",
      "room_id,property_id,room_type_id,room_number,housekeeping_status,is_out_of_order",
      "room_id",
    ),
    readRows<Dataset["reservations"][number]>(
      "reservation",
      "reservation_id,property_id,customer_id,booking_partner_id,check_in,check_out,status,note",
      "reservation_id",
      checkIn,
    ),
    readRows<Dataset["reservationRooms"][number]>(
      "reservation_room",
      "reservation_room_id,reservation_id,room_type_id,room_id,rate_amount,stay_status",
      "reservation_room_id",
    ),
    readRows<Dataset["refs"][number]>(
      "reservation_ref",
      "reservation_id,ref_type,ref_number",
      "reservation_id,ref_type,ref_number",
    ),
    readRows<Dataset["payments"][number]>(
      "payment",
      "payment_id,reservation_id,payment_method,amount,paid_at,bill_to_partner_id",
      "payment_id",
    ),
    readRows<Dataset["charges"][number]>(
      "reservation_charge",
      "reservation_charge_id,reservation_id,charge_item_id,quantity,unit_price,charged_at",
      "reservation_charge_id",
    ),
    readRows<Dataset["chargeItems"][number]>(
      "charge_item",
      "charge_item_id,property_id,item_name,default_price,is_active",
      "charge_item_id",
    ),
    readRows<Dataset["rateTypes"][number]>(
      "rate_type",
      "rate_type_id,property_id,rate_type_name",
      "rate_type_id",
    ),
  ]);
  return {
    properties,
    customers,
    partners,
    roomTypes,
    rooms,
    reservations,
    reservationRooms,
    refs,
    payments,
    charges,
    chargeItems,
    rateTypes,
  };
}
