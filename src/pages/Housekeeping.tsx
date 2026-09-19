import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { Dataset, ReservationRow } from "../lib/types";
import { addDays, hotelDate, reservationRows } from "../lib/domain";
import {
  buildRoomGrid,
  calculateDailyOccupancy,
  computeRoomState,
  housekeepingAssignments,
  monthDates,
  validateRoomAssignments,
  type HousekeepingData,
} from "../lib/housekeeping";
import { loadHousekeepingData } from "../lib/housekeepingData";
import { useHousekeepingNotes } from "../lib/useHousekeepingNotes";
import {
  housekeepingPrintHtml,
  printHousekeeping,
} from "../lib/housekeepingPrint";
import "../housekeeping.css";

const labels: Record<string, string> = {
  vacant: "공실",
  stayover: "재실",
  checkout_cleaning: "미정비",
  out_of_order: "고장·판매불가",
};
export function Housekeeping({
  data,
  propertyId,
  day,
  onDayChange,
  live,
  active,
  onSelect,
  onUpdated,
}: {
  data: Dataset;
  propertyId: number;
  day: string;
  onDayChange: (value: string) => void;
  live: boolean;
  active: boolean;
  onSelect: (row: ReservationRow) => void;
  onUpdated: () => Promise<void>;
}) {
  const [loaded, setLoaded] = useState<{
    month: string;
    data: HousekeepingData;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  async function updateCleaning(status: "정비완료" | "미정비", id = roomId) {
    if (!live || !supabase || id === null || pending.current) return;
    const number =
      source?.rooms.find((r) => r.room_id === id)?.room_number ?? "";
    pending.current = true;
    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      const { error } = await supabase.rpc("pms_update_housekeeping", {
        p_room_id: id,
        p_status: status,
      });
      if (error) throw error;
      setLoaded((old) =>
        old
          ? {
              ...old,
              data: {
                ...old.data,
                rooms: old.data.rooms.map((r) =>
                  r.room_id === id ? { ...r, housekeeping_status: status } : r,
                ),
              },
            }
          : old,
      );
      setSaveMessage(`${number}호를 ${status === "정비완료" ? "공실" : status}로 저장했습니다.`);
      try {
        await onUpdated();
      } catch {
        setSaveError(
          "저장은 완료됐지만 화면 갱신에 실패했습니다. 새로고침해 주세요.",
        );
      }
    } catch (e) {
      setSaveError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "정비 상태 저장에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const month = day.slice(0, 7);
  const memo = useHousekeepingNotes(propertyId, day, live);
  useEffect(() => {
    if (!live || !active) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    loadHousekeepingData(propertyId, month + "-01")
      .then((next) => {
        if (!cancelled) setLoaded({ month, data: next });
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "청소표 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId, month, live, active, revision, data]);
  const source = live ? loaded?.data : data;
  const report = useMemo(() => {
    if (!source) return null;
    const rooms = source.rooms.filter((r) => r.property_id === propertyId);
    const assignments = housekeepingAssignments(source, propertyId);
    const states = rooms.map((room) =>
      computeRoomState(room, assignments, day),
    );
    return {
      rooms,
      assignments,
      states,
      grid: buildRoomGrid(rooms),
      counts: validateRoomAssignments(assignments, day),
      daily: monthDates(day).map((date) =>
        calculateDailyOccupancy(rooms, assignments, date),
      ),
    };
  }, [source, propertyId, day]);
  const busy = live && (loading || loaded?.month !== month);
  const selected = report?.states.find((s) => s.room.room_id === roomId);
  const rows = reservationRows(data, propertyId);
  return (
    <div className="hk-page">
      {saveMessage && <p role="status">{saveMessage}</p>}
      {saveError && (
        <p role="alert" className="error-text">
          {saveError}
        </p>
      )}
      <div className="hk-toolbar">
        <strong>객실 청소표</strong>
        <button
          className="icon-button"
          aria-label="이전 영업일"
          onClick={() => onDayChange(addDays(day, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          <span className="sr-only">청소표 기준일</span>
          <input
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) onDayChange(e.target.value);
            }}
          />
        </label>
        <button
          className="icon-button"
          aria-label="다음 영업일"
          onClick={() => onDayChange(addDays(day, 1))}
        >
          <ChevronRight size={18} />
        </button>
        <button className="button" onClick={() => onDayChange(hotelDate())}>
          오늘
        </button>
        <button
          className="button"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={15} />
          청소표 새로고침
        </button>
        <button
          className="button primary"
          disabled={busy || !report || !!error || memo.loading || !!memo.error}
          onClick={() => {
            if (report)
              void printHousekeeping(
                housekeepingPrintHtml(
                  day,
                  report.grid,
                  report.states,
                  report.daily,
                  memo.notes,
                  memo.defects,
                ),
              ).catch(() => setSaveError("인쇄 화면을 열지 못했습니다."));
          }}
        >
          인쇄 / PDF
        </button>
      </div>
      <div className="hk-legend">
        {Object.entries(labels).map(([state, label]) => (
          <span key={state}>
            <i className={state} />
            {label}
          </span>
        ))}
        <span className="hk-checkin">체크인</span>
        <span>당일 체크인은 색상과 별도로 표시</span>
      </div>
      {error ? (
        <div role="alert" className="error-panel">
          {error}
          <button className="button" onClick={() => setRevision((v) => v + 1)}>
            다시 조회
          </button>
        </div>
      ) : busy || !report ? (
        <p role="status">청소표 데이터를 불러오는 중입니다…</p>
      ) : (
        <>
          <div className="hk-summary">
            {[
              ["예약 객실", report.counts.staying.total],
              ["재실·전일 투숙", report.counts.overnight.total],
              ["퇴실·청소", report.counts.departures.total],
              ["당일 체크인", report.counts.arrivals.total],
              ["미배정·예상재실", report.counts.staying.unassigned],
              [
                "고장 객실",
                report.rooms.filter((r) => r.is_out_of_order).length,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {value}
                  <small>실</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="hk-layout">
            <section className="hk-panel">
              <h3>{day} 청소표</h3>
              <div className="hk-grid-scroll">
                <div className="hk-grid">
                  <div className="hk-floor-head">
                    <span>층</span>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  {report.grid.map((floor) => (
                    <div className="hk-floor" key={floor.label}>
                      <strong>{floor.label}</strong>
                      {floor.slots.map((room, index) => {
                        if (!room)
                          return (
                            <div
                              key={`empty${index}`}
                              className="hk-slot empty"
                              aria-label="객실 없음"
                            />
                          );
                        const state = report.states.find(
                          (s) => s.room.room_id === room.room_id,
                        )!;
                        return (
                          <button
                            key={room.room_id}
                            className={`hk-slot ${state.state}`}
                            aria-label={`${room.room_number}호 ${labels[state.state]}${state.checkIn ? " 체크인" : ""}${state.warnings.length ? " 경고" : ""}`}
                            aria-pressed={roomId === room.room_id}
                            disabled={saving}
                            title={live ? "클릭하면 공실 / 미정비가 전환됩니다." : "객실 상태 보기"}
                            onClick={() => {
                              setRoomId(room.room_id);
                              void updateCleaning(room.housekeeping_status === "정비완료" ? "미정비" : "정비완료", room.room_id);
                            }}
                          >
                            <strong>{room.room_number}</strong>
                            <span>{labels[state.state]}</span>
                            <small className="hk-arrival">
                              {state.checkIn ? "체크인" : "\u00a0"}
                            </small>
                            {state.warnings.length > 0 && (
                              <b
                                className="hk-warning-dot"
                                title={state.warnings.join(" ")}
                              >
                                !
                              </b>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {!report.rooms.length && (
                <p className="hk-note">등록된 객실이 없습니다.</p>
              )}
              <p className="hk-note">
                호수 칸을 클릭하면 공실 / 미정비가 전환됩니다. 오늘 청소표는 저장된 상태에 맞춰 색상도 바뀝니다.
              </p>
            </section>
            <aside className="hk-panel">
              <h3>고장 및 특이사항</h3>
              <div className="hk-notices">
                <div className="hk-memo-editor">
                  <label>
                    특이사항
                    <textarea
                      aria-label="청소표 특이사항"
                      maxLength={10000}
                      value={memo.notes}
                      disabled={memo.loading || memo.saving}
                      placeholder="예: 1506호 추가 청소 요청"
                      onChange={(e) => memo.setNotes(e.target.value)}
                    />
                  </label>
                  <label>
                    고장 목록
                    <textarea
                      aria-label="청소표 고장 목록"
                      maxLength={10000}
                      value={memo.defects}
                      disabled={memo.loading || memo.saving}
                      placeholder="객실 / 증상 / 접수일"
                      onChange={(e) => memo.setDefects(e.target.value)}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={
                      !live ||
                      !memo.ready ||
                      memo.loading ||
                      memo.saving ||
                      !memo.dirty
                    }
                    onClick={memo.save}
                  >
                    {memo.saving ? "저장 중…" : "메모 저장"}
                  </button>
                  <p className="hk-note">
                    호텔·기준일별 메모입니다.{" "}
                    {memo.dirty
                      ? "저장하지 않은 내용이 있습니다. 날짜 이동 전에 저장해 주세요. 인쇄에는 현재 입력 내용이 반영됩니다."
                      : ""}
                    {!live && "데모에서는 저장할 수 없습니다."}
                  </p>
                  {memo.message && <p role="status">{memo.message}</p>}
                  {memo.error && (
                    <p role="alert" className="error-text">
                      {memo.error}
                      <button className="button" onClick={memo.reload}>
                        메모 다시 조회
                      </button>
                    </p>
                  )}
                </div>
                <details>
                  <summary>객실 배정 검증 및 자동 경고</summary>
                  <h4>객실 배정 검증</h4>
                  {(
                    [
                      ["당일 체크인", report.counts.arrivals],
                      ["전일 투숙", report.counts.overnight],
                      ["예상 재실", report.counts.staying],
                      ["당일 체크아웃", report.counts.departures],
                    ] as const
                  ).map(([label, count]) => (
                    <p key={label}>
                      {label} {count.total}실 · 객실배정 {count.assigned}실 ·
                      미배정 {count.unassigned}실
                    </p>
                  ))}
                  <h4>고장 객실</h4>
                  <p>
                    {report.rooms
                      .filter((r) => r.is_out_of_order)
                      .map((r) => r.room_number)
                      .join(", ") || "없음"}
                  </p>
                  <h4>상태 확인</h4>
                  {report.states.flatMap((s) =>
                    s.warnings.map((w) => (
                      <p className="hk-warning" key={`${s.room.room_id}${w}`}>
                        {s.room.room_number}호 · {w}
                      </p>
                    )),
                  )}
                  {!report.states.some((s) => s.warnings.length) && (
                    <p>감지된 충돌이 없습니다.</p>
                  )}
                  {report.daily.find((d) => d.day === day)!.available < 0 && (
                    <p className="hk-warning">
                      판매가능 객실보다 예약 객실이 많습니다.
                    </p>
                  )}
                  <p className="hk-note">
                    고장·정비 상태는 현재 값입니다. 과거 정비 이력과 객실 이동
                    이력은 저장되어 있지 않습니다.
                  </p>
                </details>
                {selected && (
                  <div className="hk-selected">
                    <h4>{selected.room.room_number}호 상세</h4>
                    <div role="group" aria-label="현재 청소상태 변경">
                      {(["정비완료", "미정비"] as const).map((status) => (
                        <button
                          key={status}
                          className="button"
                          disabled={
                            !live ||
                            saving ||
                            selected.room.housekeeping_status === status
                          }
                          aria-pressed={
                            selected.room.housekeeping_status === status
                          }
                          onClick={() => updateCleaning(status)}
                        >
                          {status === "정비완료" ? "공실" : status}로 변경
                        </button>
                      ))}
                    </div>
                    <p className="hk-note">
                      공실은 정비완료와 같은 상태입니다.
                      {!live && " 운영 DB 연결 시 변경할 수 있습니다."}
                    </p>
                    <p>선택일 상태: {labels[selected.state]}</p>
                    {selected.reservationIds.map((id) => {
                      const row = rows.find((r) => r.reservation_id === id);
                      const booking = source!.reservations.find(
                        (r) => r.reservation_id === id,
                      )!;
                      return (
                        <button
                          key={id}
                          className="button"
                          disabled={!row}
                          onClick={() => row && onSelect(row)}
                        >
                          예약 #{id} · {booking.check_in} ~ {booking.check_out}
                        </button>
                      );
                    })}
                    {!selected.reservationIds.length && (
                      <p>선택일에 연결된 예약이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
            <section className="hk-panel hk-month">
              <h3>{month} 일별 예약현황</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "일자",
                        "총객실",
                        "고장",
                        "판매가능",
                        "전일투숙",
                        "입실",
                        "퇴실",
                        "예상재실",
                        "예상공실",
                        "점유율",
                      ].map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.map((d) => (
                      <tr
                        key={d.day}
                        className={d.day === day ? "is-selected" : ""}
                        onClick={() => onDayChange(d.day)}
                      >
                        <td>
                          <button
                            className="reference-link"
                            aria-label={`${d.day} 청소표 보기`}
                            aria-current={d.day === day ? "date" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDayChange(d.day);
                            }}
                          >
                            {d.day.slice(8)}
                          </button>
                        </td>
                        {[
                          d.total,
                          d.broken,
                          d.sellable,
                          d.overnight,
                          d.arrivals,
                          d.departures,
                          d.occupied,
                          d.available,
                        ].map((v, i) => (
                          <td key={i}>{v}</td>
                        ))}
                        <td>
                          {d.occupancy === null
                            ? "—"
                            : `${d.occupancy.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hk-note">
                미배정 예약 포함 · 현재 객실 재고 기준 · 날짜를 누르면 청소표가
                바뀝니다.
              </p>
            </section>
          </div>

        </>
      )}
    </div>
  );
}
