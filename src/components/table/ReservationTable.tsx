import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ReservationRow } from "../../lib/types";
import { matchesSearch, money } from "../../lib/domain";
import { EmptyState, StatusBadge } from "../ui";
export function ReservationTable({
  rows,
  onSelect,
  compact = false,
  initialSearch = "",
  checkInDay,
  showFilters = true,
  fullDates = false,
}: {
  rows: ReservationRow[];
  onSelect: (r: ReservationRow) => void;
  compact?: boolean;
  initialSearch?: string;
  checkInDay?: string;
  showFilters?: boolean;
  fullDates?: boolean;
}) {
  const [startDate, setStartDate] = useState(checkInDay ?? "");
  const [endDate, setEndDate] = useState(checkInDay ?? "");
  const invalidDates = !!(startDate && endDate && startDate > endDate);
  const [search, setSearch] = useState(initialSearch),
    [status, setStatus] = useState(""),
    [partner, setPartner] = useState(""),
    [page, setPage] = useState(1);
  const [sort, setSort] = useState<{
    key: "check_in" | "customer" | "amount";
    asc: boolean;
  }>({ key: "check_in", asc: true });
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            matchesSearch(r, search) &&
            (!checkInDay ||
              (!invalidDates &&
                (!startDate || r.check_in >= startDate) &&
                (!endDate || r.check_in <= endDate))) &&
            (!status || r.status === status) &&
            (!partner || r.partner === partner),
        )
        .sort((a, b) => {
          const av = a[sort.key],
            bv = b[sort.key];
          return (
            (typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), "ko")) *
            (sort.asc ? 1 : -1)
          );
        }),
    [
      rows,
      search,
      status,
      partner,
      sort,
      checkInDay,
      startDate,
      endDate,
      invalidDates,
    ],
  );
  const size = compact ? 5 : 10,
    pages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, pages);
  function toggle(key: typeof sort.key) {
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
    setPage(1);
  }
  return (
    <div className="table-card">
      {checkInDay && (
        <div className="reservation-list-dates">
          <span className="reservation-date-label">체크인</span>
          <label>
            <span className="sr-only">체크인 시작일</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <span aria-hidden="true">~</span>
          <label>
            <span className="sr-only">체크인 종료일</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            className="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
          >
            전체 기간
          </button>
          <p>체크인 날짜 기준 · 시작일과 종료일 포함 · 객실 미배정 예약 포함</p>
          {invalidDates && (
            <p role="alert" className="error-text">
              종료일은 시작일 이후 또는 같은 날짜로 선택하세요.
            </p>
          )}
        </div>
      )}
      {!compact && showFilters && (
        <div className="table-toolbar">
          <div className="filter-search">
            <Search size={16} />
            <input
              aria-label="목록 검색"
              placeholder="예약번호, 고객명, 객실 검색"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="거래처 필터"
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value);
              setPage(1);
            }}
          >
            <option value="">전체 거래처</option>
            {[...new Set(rows.map((r) => r.partner))].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            aria-label="예약 상태 필터"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">전체 상태</option>
            {["예약", "재실", "퇴실", "취소"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="result-count">{filtered.length}건</span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>예약번호</th>
              <th
                aria-sort={
                  sort.key === "customer"
                    ? sort.asc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button onClick={() => toggle("customer")}>
                  고객명
                  <ArrowDownUp size={12} />
                </button>
              </th>
              <th>객실</th>
              <th>거래처</th>
              <th
                aria-sort={
                  sort.key === "check_in"
                    ? sort.asc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button onClick={() => toggle("check_in")}>
                  입실
                  <ArrowDownUp size={12} />
                </button>
              </th>
              <th>퇴실</th>
              <th>상태</th>
              {!compact && (
                <th
                  className="numeric"
                  aria-sort={
                    sort.key === "amount"
                      ? sort.asc
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => toggle("amount")}>
                    객실 요금 합계
                    <ArrowDownUp size={12} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * size, current * size).map((r) => (
              <tr
                key={r.reservation_id}
                className="clickable-row"
                onClick={() => onSelect(r)}
              >
                <td>
                  <button
                    className="reference-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r);
                    }}
                  >
                    {r.reference}
                  </button>
                </td>
                <td className="customer-name">{r.customer}</td>
                <td>{r.roomLabel}</td>
                <td>{r.partner}</td>
                <td>
                  {checkInDay || fullDates
                    ? r.check_in
                    : r.check_in.slice(5).replace("-", ".")}
                </td>
                <td>
                  {checkInDay || fullDates
                    ? r.check_out
                    : r.check_out.slice(5).replace("-", ".")}
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                {!compact && <td className="numeric">{money(r.amount)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <EmptyState />}
      {filtered.length > 0 && (
        <div className="pagination">
          <span>
            총 {filtered.length}건 · {(current - 1) * size + 1}–
            {Math.min(current * size, filtered.length)}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="이전 페이지"
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
              aria-label="다음 페이지"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
