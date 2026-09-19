import { expect, test } from "@playwright/test";
import { hotelDate, addDays } from "../src/lib/domain";
test("입실 예정 목록의 오늘 기본조건, 조회, 초기화", async ({ page }) => {
  await page.goto("/#/express/arrivals");
  const panel = page.locator(".work-panel:not([hidden])");
  await expect(panel.getByLabel("입실 시작일")).toHaveValue(hotelDate());
  await expect(panel.getByLabel("입실 종료일")).toHaveValue(hotelDate());
  await expect(panel.locator("tbody tr")).toHaveCount(4);
  await expect(panel.locator("tbody")).toContainText("미배정");
  await panel.getByLabel("입실 시작일").fill(addDays(hotelDate(), -2));
  await panel.getByRole("button", { name: "조회", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(4);
  await panel.getByLabel("고객명", { exact: true }).fill("윤서아");
  await panel.getByRole("button", { name: "조회", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(1);
  await panel.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(4);
});
