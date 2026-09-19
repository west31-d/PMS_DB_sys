import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import type { Dataset, ReservationRow } from "../lib/types";
import { hotelDate, money } from "../lib/domain";
import {
  checkInReport,
  defaultCheckInFilters,
  reportCsv,
  type CheckInFilters,
} from "../lib/checkIns";
import { loadDataset } from "../lib/supabase";
import { EmptyState, StatusBadge } from "../components/ui";
import { ReservationDrawer } from "../components/reservation/ReservationDrawer";
import "../checkIns.css";
export function CheckedIn({
  data,
  propertyId,
  live,
  active,
  mode = "check_in",
}: {
  data: Dataset;
  propertyId: number;
  live: boolean;
  active: boolean;
  mode?: "check_in" | "check_out" | "arrivals";
}) {
  const label = mode === "check_out" ? "퇴실" : "입실";
  const roomState = mode === "check_out" ? "퇴실" : mode === "arrivals" ? "예약" : "재실";
  const title = mode === "arrivals" ? "입실 예정" : `실 ${label}`;
  const dateField = mode === "check_out" ? "check_out" : "check_in";
  const [draft, setDraft] = useState(() => defaultCheckInFilters(hotelDate()));
  const [applied, setApplied] = useState(draft),
    [revision, setRevision] = useState(0),
    [result, setResult] = useState<Dataset>(data),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [validation, setValidation] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<ReservationRow | null>(null);
  useEffect(() => {
    let active = true;
    setSelected(null);
    setError("");
    if (!live) {
      setResult(data);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadDataset({ propertyId, from: applied.from, to: applied.to, dateField })
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "조회하지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data, propertyId, live, applied, revision, dateField]);
  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);
  const rows = useMemo(
    () => checkInReport(result, propertyId, applied, mode),
    [result, propertyId, applied, mode],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20)),
    current = Math.min(page, pages);
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  function change(key: keyof CheckInFilters, value: string) {
    setDraft((old) => ({ ...old, [key]: value }));
    setValidation("");
  }
  function reset() {
    const defaults = defaultCheckInFilters(hotelDate());
    setDraft(defaults);
    setApplied(defaults);
    setPage(1);
    setValidation("");
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}목록_${applied.from}_${applied.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="checkin-layout">
      <form
        className="checkin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.from || !draft.to || draft.from > draft.to) {
            setValidation(`${label} 시작일은 종료일보다 늦을 수 없습니다.`);
            return;
          }
          setValidation("");
          setApplied({ ...draft });
          setRevision((v) => v + 1);
          setPage(1);
        }}
      >
        <div className="checkin-filter-title">
          <SlidersHorizontal size={17} />
          <strong>조회 조건</strong>
        </div>
        <label>
          프로퍼티
          <input
            readOnly
            value={
              data.properties.find((p) => p.property_id === propertyId)
                ?.property_name ?? ""
            }
          />
        </label>
        <fieldset>
          <legend>
            {mode === "arrivals" ? "체크인 날짜" : mode === "check_out" ? "퇴실날짜" : "입실일자"} <span>*</span>
          </legend>
          <div className="checkin-date-range">
            <input
              aria-label={`${label} 시작일`}
              type="date"
              required
              value={draft.from}
              onChange={(e) => change("from", e.target.value)}
            />
            <span>~</span>
            <input
              aria-label={`${label} 종료일`}
              type="date"
              required
              value={draft.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </div>
        </fieldset>
        <label>
          고객명
          <input
            value={draft.customer}
            placeholder="고객명 입력"
            onChange={(e) => change("customer", e.target.value)}
          />
        </label>
        <label>
          객실번호
          <input
            value={draft.roomNumber}
            placeholder="예: 301"
            onChange={(e) => change("roomNumber", e.target.value)}
          />
        </label>
        <label>
          예약번호
          <input
            value={draft.reference}
            placeholder="내부 / 외부 예약번호"
            onChange={(e) => change("reference", e.target.value)}
          />
        </label>
        <label>
          거래처
          <select
            value={draft.partnerId}
            onChange={(e) => change("partnerId", e.target.value)}
          >
            <option value="">전체 거래처</option>
            {data.partners.map((p) => (
              <option key={p.partner_id} value={p.partner_id}>
                {p.partner_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          객실타입
          <select
            value={draft.roomTypeId}
            onChange={(e) => change("roomTypeId", e.target.value)}
          >
            <option value="">전체 객실타입</option>
            {data.roomTypes
              .filter((t) => t.property_id === propertyId)
              .map((t) => (
                <option key={t.room_type_id} value={t.room_type_id}>
                  {t.room_type_name}
                </option>
              ))}
          </select>
        </label>
        <div className="checkin-status">
          <span>객실 상태</span>
          <StatusBadge status={roomState} />
        </div>

        {validation && (
          <p className="error-text" role="alert">
            {validation}
          </p>
        )}
        <div className="checkin-filter-actions">
          <button className="button primary" type="submit" disabled={loading}>
            <Search size={15} />
            {loading ? "조회 중…" : "조회"}
          </button>
          <button
            className="button"
            type="button"
            onClick={reset}
            disabled={loading}
          >
            <RotateCcw size={14} />
            초기화
          </button>
        </div>
      </form>
      <section className="checkin-results" aria-label={`${title} 조회 결과`}>
        <div className="checkin-result-toolbar">
          <div>
            <strong>{title} 현황</strong>
            <span>
              {applied.from} ~ {applied.to}
            </span>
          </div>
          <button
            className="button"
            disabled={loading || !!error || !rows.length}
            onClick={download}
          >
            <Download size={15} />
            엑셀용 CSV
          </button>
        </div>
        {loading ? (
          <div className="loading" role="status">
            조건에 맞는 {title} 목록을 조회 중입니다…
          </div>
        ) : error ? (
          <div className="error-panel" role="alert">
            <strong>{title} 목록을 조회하지 못했습니다</strong>
            <p>{error}</p>
            <button
              className="button"
              onClick={() => setRevision((v) => v + 1)}
            >
              다시 조회
            </button>
          </div>
        ) : (
          <>
            <div className="checkin-summary">
              {mode === "check_out" && <small>체크아웃 날짜 기준 · 퇴실 객실이 있는 예약 · 금액과 상태는 예약 전체 기준</small>}
              <span>
                조회 <strong>{rows.length}</strong>건
              </span>
              <span>
                객실료 + 서비스 <strong>{money(total)}</strong>
              </span>
            </div>
            <div className="table-scroll checkin-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "예약번호",
                      "객실번호",
                      "고객명",
                      "입실일자",
                      "입실시간",
                      "퇴실일자",
                      "박수",
                      "객실타입",
                      "객실료 합계",
                      "서비스",
                      "합계",
                      "거래처명",
                      "요금타입",
                      "예약 상태",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((current - 1) * 20, current * 20).map((r) => (
                    <tr
                      key={r.reservation_id}
                      className="clickable-row"
                      onClick={() => setSelected(r)}
                    >
                      <td>
                        <button
                          className="reference-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        >
                          {r.reference}
                        </button>
                      </td>
                      <td>{r.roomLabel}</td>
                      <td className="customer-name">{r.customer}</td>
                      <td>{r.check_in}</td>
                      <td className="muted" title="입실시간 정보 없음">
                        —
                      </td>
                      <td>{r.check_out}</td>
                      <td className="numeric">{r.nights}</td>
                      <td>{r.roomTypes}</td>
                      <td className="numeric">{money(r.amount)}</td>
                      <td className="numeric">{money(r.service)}</td>
                      <td className="numeric">{money(r.total)}</td>
                      <td>{r.partner}</td>
                      <td className="muted" title="요금타입 연결 준비 중">
                        —
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <EmptyState
                title={`조건에 맞는 ${title} 내역이 없습니다`}
                description={`선택한 ${label}일 범위에 해당하고 예약 객실별 숙박 상태가 ${roomState}인 예약만 표시합니다.`}
              />
            )}
            <div className="pagination">
              <span>총 {rows.length}건</span>
              <div>
                <button
                  className="icon-button"
                  aria-label="이전 결과 페이지"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {current} / {pages}
                </span>
                <button
                  className="icon-button"
                  aria-label="다음 결과 페이지"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <ReservationDrawer
        live={live}
        onUpdated={async () =>
          setResult(
            await loadDataset({
              propertyId,
              from: applied.from,
              to: applied.to,
              dateField,
            }),
          )
        }
        row={selected}
        data={result}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
