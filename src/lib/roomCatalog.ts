import type { Dataset } from "./types";
export async function loadRoomCatalog(): Promise<{
  data: Dataset;
  syncedAt: string;
}> {
  const response = await fetch(
    import.meta.env.BASE_URL + "data/room-catalog.json",
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "객실 데이터가 없습니다. npm run sync:rooms로 Supabase에서 동기화해 주세요.",
    );
  let catalog;
  try {
    catalog = await response.json();
  } catch {
    throw new Error(
      "객실 데이터가 없습니다. npm run sync:rooms로 동기화해 주세요.",
    );
  }
  if (
    !Array.isArray(catalog.properties) ||
    !Array.isArray(catalog.rooms) ||
    !Array.isArray(catalog.roomTypes) ||
    typeof catalog.syncedAt !== "string"
  )
    throw new Error("객실 데이터 형식을 확인해 주세요.");
  return {
    syncedAt: catalog.syncedAt,
    data: {
      properties: catalog.properties,
      roomTypes: catalog.roomTypes,
      rooms: catalog.rooms,
      customers: [],
      partners: [],
      reservations: [],
      reservationRooms: [],
      refs: [],
      payments: [],
      charges: [],
      chargeItems: [],
      rateTypes: [],
    },
  };
}
