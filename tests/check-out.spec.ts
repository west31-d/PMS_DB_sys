import { expect, test } from "@playwright/test";
test("퇴실 팝업 목록·예약 잔액·객실 선택·재열기 초기화", async ({ page }) => {
  await page.goto("/");
  const open = page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "퇴실", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "퇴실", exact: true });
  await expect(dialog.locator(".checkout-bookings > button")).toHaveCount(2);
  await dialog.locator(".checkout-bookings > button").first().click();
  await expect(dialog.locator(".checkout-totals")).toContainText("30,000");
  await dialog.getByRole("checkbox").check();
  await expect(dialog.locator(".checkout-actions")).toContainText("선택 1실");
  await expect(
    dialog.getByRole("button", { name: "선택 객실 퇴실" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "투숙객", exact: true }).click();
  await expect(dialog.locator(".checkout-bookings > button")).toHaveCount(4);
  await dialog.getByLabel("검색", { exact: true }).fill("김하늘");
  await expect(dialog.locator(".checkout-bookings > button")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await open.click();
  await expect(dialog.getByLabel("검색", { exact: true })).toHaveValue("");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
    .toBeTruthy();
  await dialog.getByRole("button", { name: "퇴실 창 닫기" }).click();
  await expect(dialog).not.toBeVisible();
});
