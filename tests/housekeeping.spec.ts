import { expect, test } from "@playwright/test";
import { addDays, hotelDate } from "../src/lib/domain";

test("청소표 메모 입력과 원본 인쇄 양식", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto("/#/housekeeping/cleaning");
  const panel = page.locator(".work-panel:not([hidden])");
  await panel
    .getByLabel("청소표 특이사항")
    .fill("1506호 추가 청소\n<script>테스트</script>");
  await panel.getByLabel("청소표 고장 목록").fill("301호 / 에어컨 확인");
  await panel.getByRole("button", { name: "인쇄 / PDF" }).click();
  const print = page.frameLocator('iframe[title="청소표 인쇄"]');
  await expect(print.locator(".nbody").first()).toHaveText(
    "1506호 추가 청소\n<script>테스트</script>",
  );
  await expect(print.locator("script")).toHaveCount(0);
  await expect(print.locator(".panel")).toHaveCount(3);
  await expect(print.locator(".grid .ci")).toHaveCount(24);
  await expect(print.locator(".daily th")).toHaveCount(10);
  const html = await print.locator("html").evaluate((el) => el.outerHTML);
  const preview = await page.context().newPage();
  await preview.setContent(html);
  const pdf = await preview.pdf({
    path: "test-results/housekeeping-print.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(1);
  await preview.close();
});
test("청소표 날짜 이동·체크인 표시·월 집계·상세·모바일", async ({ page }) => {
  await page.goto("/#/housekeeping/cleaning");
  const panel = page.locator(".work-panel:not([hidden])");
  const day = hotelDate();
  await expect(panel.getByLabel("청소표 기준일")).toHaveValue(day);
  await expect(
    panel.getByRole("button", { name: /^301호/ }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "305호 공실 체크인", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".hk-notices")).toContainText(
    "당일 체크인 4실 · 객실배정 3실 · 미배정 1실",
  );
  await expect(panel.locator(".hk-grid")).not.toContainText("김하늘");
  await panel
    .getByRole("button", { name: /^301호/ })
    .click();
  await panel
    .locator(".hk-selected")
    .getByRole("button", { name: /^예약 #/ })
    .click();
  await expect(page.getByRole("dialog", { name: "예약 상세" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "예약 상세" }),
  ).not.toBeVisible();
  await panel.getByRole("button", { name: "다음 영업일" }).click();
  await expect(panel.getByLabel("청소표 기준일")).toHaveValue(addDays(day, 1));
  await panel.getByRole("button", { name: "이전 영업일" }).click();
  await expect(panel.getByLabel("청소표 기준일")).toHaveValue(day);
  await panel
    .getByRole("button", { name: day.slice(0, 7) + "-01 청소표 보기" })
    .click();
  await expect(panel.getByLabel("청소표 기준일")).toHaveValue(
    day.slice(0, 7) + "-01",
  );
  await panel.getByLabel("청소표 기준일").fill("2099-01-01");
  await expect(panel.locator(".hk-month tbody tr")).toHaveCount(31);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
});
