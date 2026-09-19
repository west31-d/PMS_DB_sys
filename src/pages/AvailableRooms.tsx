import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dataset } from "../lib/types";
import { addDays, hotelDate } from "../lib/domain";
import { availabilityReport } from "../lib/availability";
import "../availability.css";

type Metric = "available" | "booked" | "occupancy";
export function AvailableRooms({
  data,
  propertyId,
  day,
  onDayChange,
}: {
  data: Dataset;
  propertyId: number;
  day: string;
  onDayChange: (day: string) => void;
}) {
  const [days, setDays] = useState(14);
  const [metric, setMetric] = useState<Metric>("available");
  const report = availabilityReport(data, propertyId, day, days);
  const labels = {
    available: "사용 가능 객실",
    booked: "예약 객실",
    occupancy: "점유율 (%)",
  };
  const format = (value: number | null, percent = false) =>
    value === null
      ? "—"
      : percent
        ? value.toFixed(1)
        : value.toLocaleString("ko-KR");
  const summary = [
    { label: "예약 객실", values: report.totals.map((d) => d.booked) },
    {
      label: "점유율 (%)",
      values: report.totals.map((d) => d.occupancy),
      percent: true,
    },
    {
      label: "판매 가능 객실",
      values: report.dates.map(() => report.sellable),
    },
    { label: "고장 객실", values: report.dates.map(() => report.broken) },
    { label: "내부 사용 객실", values: report.dates.map(() => null) },
    {
      label: "무료 객실 (0원)",
      values: report.totals.map((d) => d.complimentary),
    },
  ];
  return (
    <section className="availability-panel" aria-label="날짜별 사용 가능 객실">
      <div className="availability-toolbar">
        <div className="availability-period">
          <button
            className="icon-button"
            aria-label="이전 조회 기간"
            onClick={() => onDayChange(addDays(day, -days))}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {day.replaceAll("-", ".")} —{" "}
            {addDays(day, days - 1).replaceAll("-", ".")}
          </strong>
          <button
            className="icon-button"
            aria-label="다음 조회 기간"
            onClick={() => onDayChange(addDays(day, days))}
          >
            <ChevronRight size={17} />
          </button>
          <button className="button" onClick={() => onDayChange(hotelDate())}>
            오늘
          </button>
        </div>
        <label>
          선택{" "}
          <select
            aria-label="객실 집계 항목"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          기간{" "}
          <select
            aria-label="객실 집계 기간"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={14}>2주</option>
            <option value={30}>30일</option>
          </select>
        </label>
        <span className="availability-status">예약·재실 기준</span>
      </div>
      <div
        className="availability-scroll"
        tabIndex={0}
        role="region"
        aria-label="객실 집계표, 가로 스크롤 가능"
      >
        <table
          className="availability-table"
          style={{ minWidth: 190 + days * 66 }}
        >
          <caption className="sr-only">
            {labels[metric]} · {day}부터 {days}일
          </caption>
          <colgroup>
            <col style={{ width: 120 }} />
            <col style={{ width: 70 }} />
            {report.dates.map((date) => (
              <col key={date} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className="availability-type">
                객실타입
              </th>
              <th rowSpan={2} scope="col" className="availability-count">
                객실수
              </th>
              {report.dates.map((date) => (
                <th key={date} scope="col" className={weekend(date)}>
                  {date.slice(5).replace("-", "/")}
                </th>
              ))}
            </tr>
            <tr>
              {report.dates.map((date) => (
                <th key={date} scope="col" className={weekend(date)}>
                  {
                    ["일", "월", "화", "수", "목", "금", "토"][
                      new Date(date + "T00:00:00Z").getUTCDay()
                    ]
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.types.map((type) => (
              <tr key={type.room_type_id}>
                <th scope="row" className="availability-type">
                  {type.room_type_name}
                </th>
                <td className="availability-count">{type.total}</td>
                {type.days.map((d, i) => (
                  <td
                    key={report.dates[i]}
                    className={
                      d[metric] !== null && d[metric]! < 0
                        ? "availability-negative"
                        : ""
                    }
                  >
                    {format(d[metric], metric === "occupancy")}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="availability-total">
              <th scope="row" className="availability-type">
                합계
              </th>
              <td className="availability-count">{report.total}</td>
              {report.totals.map((d, i) => (
                <td
                  key={report.dates[i]}
                  className={
                    d[metric] !== null && d[metric]! < 0
                      ? "availability-negative"
                      : ""
                  }
                >
                  {format(d[metric], metric === "occupancy")}
                </td>
              ))}
            </tr>
            {summary.map((row) => (
              <tr key={row.label}>
                <th scope="row" colSpan={2} className="availability-summary">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td key={report.dates[i]}>{format(value, row.percent)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!report.types.length && (
        <p className="availability-note">등록된 객실타입이 없습니다.</p>
      )}
      <p className="availability-note">
        미배정 예약 포함 · 퇴실일 제외 · 점유율 = 예약 객실 ÷ 판매 가능 객실.
        음수는 초과 예약입니다.
        <br />
        고장 객실은 현재 상태를 전 기간에 적용합니다. 청소 상태는 날짜별 판매
        재고에서 차감하지 않습니다. 내부 사용은 구분 정보가 없어 —로 표시합니다.
      </p>
    </section>
  );
}
function weekend(date: string) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return day === 0
    ? "availability-sunday"
    : day === 6
      ? "availability-saturday"
      : "";
}
