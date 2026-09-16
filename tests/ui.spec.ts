import { expect, test } from "@playwright/test";
import { groups } from "../src/navigation";

test("대시보드, 검색, 상세 패널과 키보드 닫기", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("데모", { exact: true })).toBeVisible();
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-room"),
  ).toHaveCount(24);
  await page.screenshot({
    path: "test-results/dashboard-1440.png",
    fullPage: true,
  });
  await page.getByRole("textbox", { name: "전체 예약 검색" }).fill("Alex");
  await page.getByRole("textbox", { name: "전체 예약 검색" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "통합 DB", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".work-panel:not([hidden]) tbody tr")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "TS-2609-0005", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "예약 상세" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alex Morgan" }),
  ).toBeVisible();
  await expect(page.getByText("연결 준비 중")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "예약 상세" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "TS-2609-0005", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("예약 상태 필터, 정렬, 날짜별 조회", async ({ page }) => {
  await page.goto("/#/express/reservations");
  await expect(page.locator(".work-panel:not([hidden]) tbody tr")).toHaveCount(
    8,
  );
  await page
    .getByRole("combobox", { name: "예약 상태 필터" })
    .selectOption("재실");
  await expect(page.locator(".work-panel:not([hidden]) tbody tr")).toHaveCount(
    4,
  );
  await page.getByRole("button", { name: "고객명", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "고객명" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("button", { name: "고객명", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "고객명" }),
  ).toHaveAttribute("aria-sort", "descending");
  await page.goto("/#/express/arrivals");
  await expect(page.locator(".work-panel:not([hidden]) tbody tr")).toHaveCount(
    4,
  );
  await page.getByLabel("조회 기준일", { exact: true }).fill("2000-01-01");
  await expect(page.getByText("조회 결과가 없습니다")).toBeVisible();
});

test("모든 메뉴 경로를 직접 열고 새로고침할 수 있다", async ({ page }) => {
  for (const group of groups) {
    for (const [id, label] of group.items) {
      await page.goto("/#/" + group.id + "/" + id);
      await expect(
        page.getByRole("heading", { name: label, exact: true }).first(),
      ).toBeVisible();
      await expect(page.locator(".nav-item.active")).toHaveText(label);
    }
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "폴리오", exact: true }),
  ).toBeVisible();
  await page.goto("/#/development/schema");
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
  ).toBeVisible();
});

test("접기와 노트북/모바일 메뉴 이동", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 접기", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/is-collapsed/);
  await page.getByRole("button", { name: "메뉴 펼치기" }).click();
  for (const width of [1920, 1440, 1024, 800, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1920)
      await page.screenshot({
        path: "test-results/dashboard-1920.png",
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "객실관리(HK)", exact: true }).click();
  await page.getByRole("link", { name: "청소표", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "청소표", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sidebar-scrim")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/rooms-mobile.png",
    fullPage: true,
  });
});

test("빈 검색, 고장/정비 상태와 게스트 계정 안내", async ({ page }) => {
  await page.goto("/#/booking/all?q=NO_MATCH");
  await expect(page.getByText("조회 결과가 없습니다")).toBeVisible();
  await page.goto("/#/housekeeping/out-of-order");
  await expect(page.locator(".work-panel:not([hidden]) tbody tr")).toHaveCount(
    2,
  );
  await expect(page.locator(".info-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "게스트" }).click();
  await expect(page.getByRole("dialog", { name: "계정" })).toBeVisible();
  await expect(
    page.getByText("현재 로그인 연결 전입니다.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "계정" })).not.toBeVisible();
});

test("객실 현황표 기간·필터·예약 상세", async ({ page }) => {
  await page.goto("/#/express/dashboard");
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-date"),
  ).toHaveCount(14);
  await expect(
    page.locator(".work-panel:not([hidden]) .booking-bar"),
  ).toHaveCount(5);
  await expect(
    page.locator(".work-panel:not([hidden]) .unassigned-list button"),
  ).toHaveCount(1);
  await page
    .locator(".work-panel:not([hidden]) .booking-bar")
    .filter({ hasText: "Alex Morgan" })
    .click();
  await expect(page.getByRole("dialog", { name: "예약 상세" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "1개월", exact: true }).click();
  expect(
    await page.locator(".work-panel:not([hidden]) .timeline-date").count(),
  ).toBeGreaterThanOrEqual(28);
  await page.getByRole("combobox", { name: "층 필터" }).selectOption("3F");
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-room"),
  ).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "현황표 객실타입" })
    .selectOption("1");
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-room"),
  ).toHaveCount(2);
  await page.getByRole("combobox", { name: "층 필터" }).selectOption("");
  await page
    .getByRole("combobox", { name: "현황표 객실타입" })
    .selectOption("");
  await page.getByRole("textbox", { name: "현황표 검색" }).fill("Alex");
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-room"),
  ).toHaveCount(1);
  await page.getByRole("textbox", { name: "현황표 검색" }).fill("");
  await page.getByLabel("조회 기준일", { exact: true }).fill("2000-01-01");
  await expect(
    page.locator(".work-panel:not([hidden]) .booking-bar"),
  ).toHaveCount(0);
  await expect(
    page.locator(".work-panel:not([hidden]) .timeline-room"),
  ).toHaveCount(24);
  await page.getByRole("button", { name: "다음 기간", exact: true }).click();
  await expect(page.getByLabel("조회 기준일", { exact: true })).toHaveValue(
    "2000-02-01",
  );
});

test("실 입실 기본 AND 조건과 변경 조회·초기화·내보내기", async ({ page }) => {
  await page.goto("/#/express/checked-in");
  await expect(
    page.getByRole("heading", { name: "실 입실 목록", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("조건에 맞는 실 입실 내역이 없습니다"),
  ).toBeVisible();
  const today = await page
    .getByLabel("입실 시작일", { exact: true })
    .inputValue();
  const prior = new Date(today + "T00:00:00Z");
  prior.setUTCDate(prior.getUTCDate() - 2);
  await page
    .getByLabel("입실 시작일", { exact: true })
    .fill(prior.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(
    page.locator(".work-panel:not([hidden]) .checkin-table tbody tr"),
  ).toHaveCount(4);
  await expect(
    page.locator(".work-panel:not([hidden]) .checkin-table .badge"),
  ).toHaveText(["재실", "재실", "재실", "재실"]);
  await page.screenshot({
    path: "test-results/checked-in-1440.png",
    fullPage: true,
  });
  await page.getByLabel("고객명", { exact: true }).fill("김하늘");
  await expect(
    page.locator(".work-panel:not([hidden]) .checkin-table tbody tr"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(
    page.locator(".work-panel:not([hidden]) .checkin-table tbody tr"),
  ).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "엑셀용 CSV" }).click();
  expect((await download).suggestedFilename()).toContain("실입실목록_");
  await page.getByRole("button", { name: "TS-2609-0001", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "예약 상세" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("입실 종료일", { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("입실 시작일");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(page.getByLabel("입실 시작일", { exact: true })).toHaveValue(
    today,
  );
  await expect(
    page.getByText("조건에 맞는 실 입실 내역이 없습니다"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("업무 탭 상태 보존과 메뉴 자동 접기", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "실 입실 목록", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/is-collapsed/);
  await expect(
    page.getByRole("tab", { name: "실 입실 목록", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("고객명", { exact: true }).fill("보존할 고객");
  await page
    .locator(".top-header")
    .getByRole("button", { name: "메뉴 열기", exact: true })
    .click();
  await page.getByRole("link", { name: "예약 목록", exact: true }).click();
  await page
    .getByRole("combobox", { name: "예약 상태 필터" })
    .selectOption("재실");
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByRole("tab", { name: "실 입실 목록", exact: true }).click();
  await expect(page.getByLabel("고객명", { exact: true })).toHaveValue(
    "보존할 고객",
  );
  await page.getByRole("tab", { name: "예약 목록", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "예약 상태 필터" }),
  ).toHaveValue("재실");
  await page
    .locator(".top-header")
    .getByRole("button", { name: "메뉴 열기", exact: true })
    .click();
  await page.getByRole("link", { name: "예약 목록", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page
    .getByRole("button", { name: "예약 목록 탭 닫기", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "실 입실 목록", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "실 입실 목록 탭 닫기", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "대시보드", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
