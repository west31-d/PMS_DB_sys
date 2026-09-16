import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  ReceiptText,
} from "lucide-react";
export const groups = [
  {
    id: "express",
    label: "익스프레스",
    icon: LayoutDashboard,
    items: [
      ["dashboard", "대시보드"],
      ["checked-in", "실 입실 목록"],
      ["checked-out", "실 퇴실 목록"],
      ["arrivals", "입실 예정 목록"],
      ["departures", "퇴실 예정 목록"],
      ["in-house", "재실 목록"],
      ["reservations", "예약 목록"],
      ["no-show", "노쇼 목록"],
      ["cards", "등록 카드"],
      ["available", "사용 가능 객실"],
    ],
  },
  {
    id: "booking",
    label: "예약",
    icon: CalendarDays,
    items: [
      ["overview", "대시보드"],
      ["agency", "데이터(여행사)"],
      ["ota", "데이터(OTA)"],
      ["all", "통합 DB"],
    ],
  },
  {
    id: "housekeeping",
    label: "객실관리(HK)",
    icon: BedDouble,
    items: [
      ["cleaning", "청소표"],
      ["out-of-order", "고장객실 등록"],
    ],
  },
  {
    id: "accounting",
    label: "정산(회계)",
    icon: ReceiptText,
    items: [
      ["closing", "일마감"],
      ["folio", "폴리오"],
    ],
  },
];
export function pageInfo(path: string) {
  for (const group of groups) {
    const item = group.items.find(([id]) => path === "/" + group.id + "/" + id);
    if (item) return { group: group.label, title: item[1], id: item[0] };
  }
  return {
    group: "ThreeSeven PMS",
    title: "페이지를 찾을 수 없습니다",
    id: "not-found",
  };
}
