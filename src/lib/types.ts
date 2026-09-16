export interface Property {
  property_id: number;
  property_name: string;
}
export interface Customer {
  customer_id: number;
  customer_name: string;
}
export interface Partner {
  partner_id: number;
  partner_name: string;
  partner_type: string;
}
export interface RoomType {
  room_type_id: number;
  property_id: number;
  room_type_name: string;
}
export interface Room {
  room_id: number;
  property_id: number;
  room_type_id: number;
  room_number: string;
  housekeeping_status: string;
  is_out_of_order: boolean;
}
export interface Reservation {
  reservation_id: number;
  property_id: number;
  customer_id: number;
  booking_partner_id: number | null;
  check_in: string;
  check_out: string;
  status: string;
  note: string | null;
}
export interface ReservationRoom {
  reservation_room_id: number;
  reservation_id: number;
  room_type_id: number;
  room_id: number | null;
  rate_amount: number;
}
export interface ReservationRef {
  reservation_id: number;
  ref_type: string;
  ref_number: string;
}
export interface Payment {
  payment_id: number;
  reservation_id: number;
  payment_method: string;
  amount: number;
  paid_at: string;
  bill_to_partner_id: number | null;
}
export interface Charge {
  reservation_charge_id: number;
  reservation_id: number;
  charge_item_id: number;
  quantity: number;
  unit_price: number;
  charged_at: string;
}
export interface ChargeItem {
  charge_item_id: number;
  property_id: number;
  item_name: string;
  default_price: number;
  is_active: boolean;
}
export interface RateType {
  rate_type_id: number;
  property_id: number;
  rate_type_name: string;
}
export interface Dataset {
  properties: Property[];
  customers: Customer[];
  partners: Partner[];
  roomTypes: RoomType[];
  rooms: Room[];
  reservations: Reservation[];
  reservationRooms: ReservationRoom[];
  refs: ReservationRef[];
  payments: Payment[];
  charges: Charge[];
  chargeItems: ChargeItem[];
  rateTypes: RateType[];
}
export interface ReservationRow extends Reservation {
  customer: string;
  partner: string;
  partnerType: string;
  reference: string;
  searchRefs: string;
  roomLabel: string;
  amount: number;
}
