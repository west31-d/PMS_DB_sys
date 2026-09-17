import { useState } from "react";
import { Search } from "lucide-react";
import type { Dataset } from "../lib/types";
import { roomStatus, isRoomOccupied } from "../lib/roomStatus";
import { availableRooms } from "../lib/domain";
import { EmptyState, StatusBadge } from "../components/ui";
export function Rooms({
  data,
  propertyId,
  day,
  mode,
}: {
  data: Dataset;
  propertyId: number;
  day: string;
  mode: string;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const base =
    mode === "available"
      ? availableRooms(data, propertyId, day)
      : data.rooms.filter(
          (r) =>
            r.property_id === propertyId &&
            (mode !== "out-of-order" || r.is_out_of_order),
        );
  const rooms = base
    .filter(
      (r) =>
        r.room_number.includes(search) &&
        (!status ||
          (status === "미정비"
            ? r.housekeeping_status === "미정비"
            : status === "재실"
              ? isRoomOccupied(data, r)
              : status === "공실"
                ? !isRoomOccupied(data, r) && !r.is_out_of_order
                : r.is_out_of_order)),
    )
    .sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
    );
  return (
    <>
      <div className="table-card">
        <div className="table-toolbar">
          <div className="filter-search">
            <Search size={16} />
            <input
              aria-label="객실번호 검색"
              value={search}
              placeholder="객실번호 검색"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="객실 상태"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">전체 상태</option>
            {["공실", "재실", "미정비", "고장"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="result-count">{rooms.length}실</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>객실번호</th>
                <th>객실타입</th>
                <th>현재 상태</th>
                <th>정비 상태</th>
                <th>사용불가 여부</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_id}>
                  <td className="customer-name">{r.room_number}</td>
                  <td>
                    {data.roomTypes.find(
                      (t) => t.room_type_id === r.room_type_id,
                    )?.room_type_name ?? "—"}
                  </td>
                  <td>
                    <StatusBadge status={roomStatus(data, r)} />
                  </td>
                  <td>{r.housekeeping_status}</td>
                  <td>{r.is_out_of_order ? "사용불가" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rooms.length && <EmptyState />}
      </div>
    </>
  );
}
