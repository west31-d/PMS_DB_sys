import type {
  buildRoomGrid,
  calculateDailyOccupancy,
  computeRoomState,
} from "./housekeeping";
import css from "../housekeepingPrint.css?raw";
const esc = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const weekday = (day: string) =>
  "일월화수목금토"[new Date(day + "T12:00:00Z").getUTCDay()];
export function housekeepingPrintHtml(
  day: string,
  grid: ReturnType<typeof buildRoomGrid>,
  states: ReturnType<typeof computeRoomState>[],
  daily: ReturnType<typeof calculateDailyOccupancy>[],
  notes: string,
  defects: string,
) {
  const color: Record<string, string> = {
    vacant: "blue",
    stayover: "red",
    checkout_cleaning: "yellow",
    out_of_order: "broken",
  };
  const rooms = grid
    .map(
      (floor) =>
        `<tr>${floor.slots
          .map((room) => {
            const state = states.find((s) => s.room.room_id === room?.room_id);
            return `<td class="room ${state ? color[state.state] : "hole"}">${room ? esc(room.room_number) : ""}${state?.state === "out_of_order" ? " (고장)" : ""}</td>`;
          })
          .join(
            "",
          )}</tr><tr>${floor.slots.map((room) => `<td class="ci">${states.find((s) => s.room.room_id === room?.room_id)?.checkIn ? "체크인" : ""}</td>`).join("")}</tr>`,
    )
    .join("");
  const rows = daily
    .map(
      (d) =>
        `<tr class="${d.day === day ? "sel" : ""}"><td>${d.day}</td><td>${weekday(d.day)}</td><td>${d.total}</td><td>${d.broken}</td><td class="b">${d.overnight}</td><td class="in">${d.arrivals}</td><td class="out">${d.departures}</td><td>${d.occupied}</td><td>${d.occupancy === null ? "—" : d.occupancy.toFixed(1)}</td><td>${d.available}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>청소표 ${day}</title><style>${css}:root{--rh:${Math.min(5.3, 148 / Math.max(1, grid.length * 2))}mm;--drh:${Math.min(5, 160 / Math.max(1, daily.length))}mm}</style></head><body><div class="sheet">
  <section class="panel p-clean"><div class="ptitle">${day.slice(0, 4)}년 ${day.slice(5, 7)}월 ${day.slice(8)}일<span class="sub">(${weekday(day)})</span></div><table class="grid">${rooms}<tr><td class="sum-l">체크인</td><td class="sum-v" colspan="5">${states.filter((s) => s.checkIn).length}</td></tr><tr><td class="sum-l">체크아웃</td><td class="sum-v y" colspan="5">${states.filter((s) => s.state === "checkout_cleaning").length}</td></tr></table></section>
  <section class="panel p-note"><div class="ptitle">고장 및 특이사항</div><div class="nbox"><div class="nbody">${esc(notes)}</div><div class="nsplit"></div><div class="nhead">고장 목록</div><div class="nbody">${esc(defects)}</div></div></section>
  <section class="panel p-daily"><div class="ptitle">일별 예약현황</div><table class="daily"><colgroup>${[17, 7, 8, 8, 8, 8, 8, 11, 16, 9].map((n) => `<col style="width:${n}%">`).join("")}</colgroup><thead><tr>${["일자", "요일", "합계", "고장", "재실", "입실", "퇴실", "예상재실수", "점유율(%)", "공실"].map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></section>
  </div></body></html>`;
}
export async function printHousekeeping(html: string) {
  const frame = document.createElement("iframe");
  frame.title = "청소표 인쇄";
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0";
  const ready = new Promise<void>((resolve) => {
    frame.onload = () => resolve();
  });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await ready;
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error("인쇄 화면을 열 수 없습니다.");
  }
  await frame.contentDocument?.fonts.ready;
  win.addEventListener("afterprint", () => frame.remove(), { once: true });
  win.focus();
  win.print();
  // Browsers that omit afterprint still release the hidden print document.
  window.setTimeout(() => frame.remove(), 300000);
}
