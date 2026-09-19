import { expect, test } from "@playwright/test";

test("사용 가능 객실의 날짜·집계 선택과 좁은 화면 가로 스크롤", async ({
  page,
}) => {
  await page.goto("/#/express/available");
  await page.getByLabel("조회 기준일", { exact: true }).fill("2099-01-01");
  const table = page.locator(".availability-table");
  await expect(table.locator("tbody tr")).toHaveCount(10);
  await expect(table.locator(".availability-total td").nth(0)).toHaveText("24");
  await expect(table.locator(".availability-total td").nth(1)).toHaveText("22");
  await expect(
    table
      .getByRole("row", { name: /^고장 객실/ })
      .locator("td")
      .first(),
  ).toHaveText("2");
  await expect(
    table
      .getByRole("row", { name: /^내부 사용 객실/ })
      .locator("td")
      .first(),
  ).toHaveText("—");
  await page.getByLabel("객실 집계 항목").selectOption("booked");
  await expect(table.locator(".availability-total td").nth(1)).toHaveText("0");
  await page.getByLabel("객실 집계 항목").selectOption("occupancy");
  await expect(table.locator(".availability-total td").nth(1)).toHaveText(
    "0.0",
  );
  await page.getByLabel("객실 집계 기간").selectOption("30");
  await expect(table.locator("thead tr").first().locator("th")).toHaveCount(32);
  await page.getByRole("button", { name: "다음 조회 기간" }).click();
  await expect(page.getByLabel("조회 기준일", { exact: true })).toHaveValue(
    "2099-01-31",
  );
  await page.getByLabel("객실 집계 항목").selectOption("available");
  await page.screenshot({
    path: "test-results/availability-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
  const scroll = page.getByRole("region", {
    name: "객실 집계표, 가로 스크롤 가능",
  });
  await scroll.evaluate((el) => {
    el.scrollLeft = 400;
  });
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/availability-mobile.png",
    fullPage: true,
  });
});
