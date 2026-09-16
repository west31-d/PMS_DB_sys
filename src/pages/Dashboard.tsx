import { Link } from "react-router-dom";
import {
  LogIn,
  LogOut,
  BedDouble,
  DoorOpen,
  Brush,
  Wrench,
  ArrowRight,
} from "lucide-react";
import type { Dataset, ReservationRow } from "../lib/types";
import { availableRooms, operationalRows } from "../lib/domain";
import { StatCard, StatusBadge } from "../components/ui";
import { ReservationTable } from "../components/table/ReservationTable";
export function Dashboard({
  data,
  rows,
  propertyId,
  day,
  onSelect,
}: {
  data: Dataset;
  rows: ReservationRow[];
  propertyId: number;
  day: string;
  onSelect: (r: ReservationRow) => void;
}) {
  const rooms = data.rooms.filter((r) => r.property_id === propertyId),
    arrivals = operationalRows(rows, "arrivals", day),
    departures = operationalRows(rows, "departures", day),
    inHouse = operationalRows(rows, "in-house", day);
  const roomCount = (rs: ReservationRow[]) =>
    data.reservationRooms.filter((rr) =>
      rs.some((r) => r.reservation_id === rr.reservation_id),
    ).length;
  const states = [
    {
      label: "공실",
      count: rooms.filter(
        (r) => !r.is_out_of_order && r.housekeeping_status === "공실",
      ).length,
      color: "#25a282",
    },
    {
      label: "재실",
      count: rooms.filter(
        (r) => !r.is_out_of_order && r.housekeeping_status === "재실",
      ).length,
      color: "#407ce8",
    },
    {
      label: "미정비",
      count: rooms.filter(
        (r) => !r.is_out_of_order && r.housekeeping_status === "미정비",
      ).length,
      color: "#e8a240",
    },
    {
      label: "고장",
      count: rooms.filter((r) => r.is_out_of_order).length,
      color: "#d76666",
    },
  ];
  return (
    <>
      <div className="stats-grid">
        <StatCard
          label="입실 예정"
          value={roomCount(arrivals)}
          to="/express/arrivals"
          tone="blue"
          icon={<LogIn size={19} />}
        />
        <StatCard
          label="퇴실 예정"
          value={roomCount(departures)}
          to="/express/departures"
          tone="purple"
          icon={<LogOut size={19} />}
        />
        <StatCard
          label="현재 재실"
          value={roomCount(inHouse)}
          to="/express/in-house"
          tone="blue"
          icon={<BedDouble size={19} />}
        />
        <StatCard
          label="사용 가능 객실"
          value={availableRooms(data, propertyId, day).length}
          to="/express/available"
          tone="green"
          icon={<DoorOpen size={19} />}
        />
        <StatCard
          label="미정비 객실"
          value={states[2].count}
          to="/housekeeping/cleaning"
          tone="orange"
          icon={<Brush size={19} />}
        />
        <StatCard
          label="고장 객실"
          value={states[3].count}
          to="/housekeeping/out-of-order"
          tone="red"
          icon={<Wrench size={19} />}
        />
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-tables">
          <section>
            <div className="section-header">
              <h2>
                입실 예정 <span>{arrivals.length}</span>
              </h2>
              <Link to="/express/arrivals">
                전체 보기 <ArrowRight size={14} />
              </Link>
            </div>
            <ReservationTable compact rows={arrivals} onSelect={onSelect} />
          </section>
          <section>
            <div className="section-header">
              <h2>
                퇴실 예정 <span>{departures.length}</span>
              </h2>
              <Link to="/express/departures">
                전체 보기 <ArrowRight size={14} />
              </Link>
            </div>
            <ReservationTable compact rows={departures} onSelect={onSelect} />
          </section>
        </div>
        <aside className="dashboard-side">
          <section className="panel">
            <div className="section-header">
              <h2>현재 객실 상태</h2>
              <BedDouble size={18} />
            </div>
            <p className="muted">
              전체 객실 <strong>{rooms.length}실</strong>
            </p>
            <div className="room-bar">
              {states.map((s) => (
                <span
                  key={s.label}
                  style={{
                    width:
                      (rooms.length ? (s.count / rooms.length) * 100 : 0) + "%",
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <div className="state-list">
              {states.map((s) => (
                <div key={s.label}>
                  <StatusBadge status={s.label} />
                  <strong>
                    {s.count}
                    <small>실</small>
                  </strong>
                </div>
              ))}
            </div>
            <Link className="button full" to="/housekeeping/cleaning">
              객실 현황 보기 <ArrowRight size={15} />
            </Link>
          </section>
          <section className="panel guide-panel">
            <span className="eyebrow">FRONT DESK</span>
            <h3>업무 바로가기</h3>
            <Link to="/booking/all">
              통합 예약 검색 <ArrowRight size={15} />
            </Link>
            <Link to="/accounting/folio">
              폴리오 조회 <ArrowRight size={15} />
            </Link>
            <p>
              입·퇴실 예정은 선택 날짜 기준,
              <br />
              객실 상태는 현재 등록 상태입니다.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
