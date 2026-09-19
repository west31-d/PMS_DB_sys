import { expect, test } from "@playwright/test";
import { addDays, hotelDate } from "../src/lib/domain";

test("체크인 기간 양끝 포함, 미배정 표시, 숙박 중 예약 제외와 기간 검증", async ({
  page,
}) => {
  await page.goto("/#/express/reservations");
  const panel = page.locator(".work-panel:not([hidden])");
  const start = panel.getByLabel("체크인 시작일", { exact: true });
  const end = panel.getByLabel("체크인 종료일", { exact: true });
  const rows = panel.locator("tbody tr");
  const today = hotelDate();
  const search = panel.getByRole("button", { name: "조회", exact: true });
  await expect(start).toHaveValue(today);
  await expect(end).toHaveValue(today);
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: "윤서아" })).toContainText("STD 미배정");
  await expect(rows.filter({ hasText: "김하늘" })).toHaveCount(0);
  await start.fill(addDays(today, -2));
  await expect(rows).toHaveCount(4);
  await search.click();
  await expect(rows).toHaveCount(8);
  await end.fill(addDays(today, -2));
  await search.click();
  await expect(rows).toHaveCount(4);
  await start.fill(today);
  await search.click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(rows).toHaveCount(4);
  await panel.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(start).toHaveValue(today);
  await expect(end).toHaveValue(today);
  await panel.getByLabel("고객명", { exact: true }).fill("윤서아");
  await panel.getByLabel("객실타입", { exact: true }).selectOption("2");
  await search.click();
  await expect(rows).toHaveCount(1);
  await panel.getByLabel("객실번호", { exact: true }).fill("301");
  await search.click();
  await expect(rows).toHaveCount(0);
  await panel.getByLabel("객실번호", { exact: true }).fill("");
  await search.click();
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page.getByRole("dialog")).toContainText("미배정");
});
