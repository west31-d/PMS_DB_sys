import type { RoomRateQuote } from "./reservationPricing";
export interface RoomRateRequest {
  propertyId: number;
  partnerId: number;
  roomTypeIds: number[];
  checkIn: string;
  checkOut: string;
}
export type RoomRateResult =
  | { status: "ready"; rates: RoomRateQuote[] }
  | { status: "not_configured"; rates: [] };
export type RoomRateProvider = (
  request: RoomRateRequest,
) => Promise<RoomRateResult>;
/** Replace this adapter only after the real rate schema is supplied.
 * Current rate_type has no partner/room-type/price relationship.
 * Never infer rates from old reservations or invent prices/table names.
 * Return rates matching the full request; throw on query errors. */
export const loadPartnerRoomRates: RoomRateProvider = async (_request) => ({
  status: "not_configured",
  rates: [],
});
