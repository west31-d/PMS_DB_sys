import type { Dataset } from "./types";
import { addDays, hotelDate } from "./domain";
const today = hotelDate();
export const demoData: Dataset = {
  properties: [{ property_id: 1, property_name: "ThreeSeven Hotel · 데모" }],
  customers: [
    "김하늘",
    "박서준",
    "이수민",
    "정지우",
    "Alex Morgan",
    "최유진",
    "오민수",
    "윤서아",
  ].map((customer_name, i) => ({ customer_id: i + 1, customer_name })),
  partners: [
    { partner_id: 1, partner_name: "아고다", partner_type: "OTA" },
    { partner_id: 2, partner_name: "한진", partner_type: "TBA" },
    { partner_id: 3, partner_name: "트립닷컴", partner_type: "OTA" },
  ],
  roomTypes: ["STT", "STD", "DTL"].map((room_type_name, i) => ({
    room_type_id: i + 1,
    property_id: 1,
    room_type_name,
  })),
  rooms: Array.from({ length: 24 }, (_, i) => ({
    room_id: i + 1,
    property_id: 1,
    room_type_id: (i % 3) + 1,
    room_number: String(301 + Math.floor(i / 6) * 100 + (i % 6)),
    housekeeping_status: i >= 18 && i < 22 ? "미정비" : "정비완료",
    is_out_of_order: i >= 22,
  })),
  reservations: Array.from({ length: 8 }, (_, i) => ({
    reservation_id: 1001 + i,
    property_id: 1,
    customer_id: i + 1,
    booking_partner_id: i % 4 === 3 ? null : (i % 3) + 1,
    check_in: i < 4 ? addDays(today, -2) : today,
    check_out: i < 2 ? today : addDays(today, i < 4 ? 1 : 2),
    status: i < 4 ? "재실" : "예약",
    note: i === 4 ? "늦은 체크인 예정. 조용한 객실 요청." : null,
  })),
  reservationRooms: Array.from({ length: 8 }, (_, i) => ({
    reservation_room_id: i + 1,
    stay_status: i < 4 ? "재실" : "예약",
    reservation_id: 1001 + i,
    room_type_id: (i % 3) + 1,
    room_id: i === 7 ? null : i + 1,
    rate_amount: 85000 + i * 5000,
  })),
  refs: Array.from({ length: 8 }, (_, i) => ({
    reservation_id: 1001 + i,
    ref_type: "내부",
    ref_number: "TS-2609-" + String(i + 1).padStart(4, "0"),
  })),
  payments: [
    {
      payment_id: 1,
      reservation_id: 1001,
      payment_method: "카드",
      amount: 85000,
      paid_at: today + "T09:00:00+09:00",
      bill_to_partner_id: null,
    },
  ],
  chargeItems: [
    {
      charge_item_id: 1,
      property_id: 1,
      item_name: "조식",
      default_price: 15000,
      is_active: true,
    },
  ],
  charges: [
    {
      reservation_charge_id: 1,
      reservation_id: 1001,
      charge_item_id: 1,
      quantity: 2,
      unit_price: 15000,
      charged_at: today + "T08:00:00+09:00",
    },
  ],
  rateTypes: [],
};
