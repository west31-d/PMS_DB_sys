import { expect, test } from "@playwright/test";
import { groups } from "../src/navigation";

test("대시보드, 검색, 상세 패널과 키보드 닫기", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("데모 모드 · 화면의 모든 데이터는 샘플입니다."),
  ).toBeVisible();
  await expect(page.locator(".timeline-room")).toHaveCount(24);
  await page.screenshot({
    path: "test-results/dashboard-1440.png",
    fullPage: true,
  });
  await page.getByRole("textbox", { name: "전체 예약 검색" }).fill("Alex");
  await page.getByRole("textbox", { name: "전체 예약 검색" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "통합 DB", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
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
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page
    .getByRole("combobox", { name: "예약 상태 필터" })
    .selectOption("재실");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "고객명", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "고객명" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("button", { name: "고객명", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "고객명" }),
  ).toHaveAttribute("aria-sort", "descending");
  await page.goto("/#/express/arrivals");
  await expect(page.locator("tbody tr")).toHaveCount(4);
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
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(
    page.getByText("고장 객실 조회 화면입니다.", { exact: false }),
  ).toBeVisible();
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
  await expect(page.locator(".timeline-date")).toHaveCount(14);
  await expect(page.locator(".booking-bar")).toHaveCount(5);
  await expect(page.locator(".unassigned-list button")).toHaveCount(1);
  await page.locator(".booking-bar").filter({ hasText: "Alex Morgan" }).click();
  await expect(page.getByRole("dialog", { name: "예약 상세" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "1개월", exact: true }).click();
  expect(await page.locator(".timeline-date").count()).toBeGreaterThanOrEqual(
    28,
  );
  await page.getByRole("combobox", { name: "층 필터" }).selectOption("3F");
  await expect(page.locator(".timeline-room")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "현황표 객실타입" })
    .selectOption("1");
  await expect(page.locator(".timeline-room")).toHaveCount(2);
  await page.getByRole("combobox", { name: "층 필터" }).selectOption("");
  await page
    .getByRole("combobox", { name: "현황표 객실타입" })
    .selectOption("");
  await page.getByRole("textbox", { name: "현황표 검색" }).fill("Alex");
  await expect(page.locator(".timeline-room")).toHaveCount(1);
  await page.getByRole("textbox", { name: "현황표 검색" }).fill("");
  await page.getByLabel("조회 기준일", { exact: true }).fill("2000-01-01");
  await expect(page.locator(".booking-bar")).toHaveCount(0);
  await expect(page.locator(".timeline-room")).toHaveCount(24);
  await page.getByRole("button", { name: "다음 기간", exact: true }).click();
  await expect(page.getByLabel("조회 기준일", { exact: true })).toHaveValue(
    "2000-02-01",
  );
});
