import { expect, test } from "@playwright/test";

test("호수 배정 적용·중복 방지·취소·수량 및 날짜 변경", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "예약", exact: true })
    .click();
  await page.getByLabel("입실일 *", { exact: true }).fill("2099-01-01");
  await page.getByLabel("퇴실일 *", { exact: true }).fill("2099-01-03");
  await page.getByRole("button", { name: "객실 추가", exact: true }).click();
  await page
    .getByRole("dialog", { name: "객실타입 선택" })
    .getByRole("button", { name: /STT/ })
    .click();
  await page.getByLabel("STT 객실 수", { exact: true }).fill("2");
  const open = page.getByRole("button", { name: "STT 호수 배정", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "객실 배정", exact: true });
  const first = dialog.locator(".assignment-room").first();
  const roomNumber = await first.locator("strong").innerText();
  await first.click();
  await dialog.getByRole("button", { name: /객실 2 · STT/ }).click();
  await expect(first).toBeDisabled();
  await dialog.locator(".assignment-room:not(:disabled)").first().click();
  await dialog.getByRole("button", { name: "배정 적용", exact: true }).click();
  await expect(open).toContainText("2/2");
  await expect(page.locator(".reservation-config-table")).toContainText(
    roomNumber,
  );
  await open.click();
  await dialog.getByLabel("객실 1 배정 해제", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(open).toContainText("2/2");
  await page.getByLabel("STT 객실 수", { exact: true }).fill("1");
  await expect(open).toContainText("1/1");
  await page.getByLabel("STT 객실 수", { exact: true }).fill("2");
  await expect(open).toContainText("1/2");
  await page.getByLabel("퇴실일 *", { exact: true }).fill("2099-01-04");
  await expect(open).toContainText("0/2");
});

test("검색 선택·객실타입 수량·요금 미등록 차단·입력 유지 및 모바일", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "예약", exact: true })
    .click();
  await page.getByLabel("고객명 *", { exact: true }).fill("신규 테스트 고객");
  await page.getByLabel("입실일 *", { exact: true }).fill("2026-09-17");
  await page.getByLabel("퇴실일 *", { exact: true }).fill("2026-09-20");
  await expect(page.locator(".reservation-stay")).toContainText("3박");
  await page.getByRole("button", { name: "예약 거래처 선택" }).click();
  const partner = page.getByRole("dialog", {
    name: "거래처 선택",
    exact: true,
  });
  await partner.getByRole("textbox").fill("OTA");
  await expect(partner.getByRole("button", { name: /한진/ })).toHaveCount(0);
  await partner.getByRole("button", { name: /아고다/ }).click();
  await expect(
    page.getByRole("button", { name: "예약 거래처 선택" }),
  ).toContainText("아고다");
  for (const type of ["STT", "STT", "STD"]) {
    await page.getByRole("button", { name: "객실 추가", exact: true }).click();
    await page
      .getByRole("dialog", { name: "객실타입 선택" })
      .getByRole("button", { name: new RegExp(type) })
      .click();
  }
  await expect(page.locator(".reservation-config-table tbody tr")).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("spinbutton", { name: "STT 객실 수", exact: true }),
  ).toHaveValue("2");
  await expect(page.getByRole("spinbutton", { name: /1박 요금/ })).toHaveCount(
    2,
  );
  await expect(page.locator(".reservation-grand-total")).toContainText(
    "요금 확인 필요",
  );
  await expect(
    page.getByRole("button", { name: "예약 저장", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "부대서비스 추가", exact: true })
    .click();
  await page.getByLabel("서비스 1 수량").fill("2");
  await expect(
    page.getByRole("region", { name: "요금 Summary" }),
  ).toContainText("30,000원");
  await page.screenshot({
    path: "test-results/reservation-revised-desktop.png",
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "예약", exact: true }),
  ).not.toBeVisible();
  await page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "예약", exact: true })
    .click();
  await expect(page.getByLabel("고객명 *", { exact: true })).toHaveValue(
    "신규 테스트 고객",
  );
  await page.getByRole("button", { name: "기존 고객", exact: true }).click();
  await page.getByRole("button", { name: "기존 고객 검색" }).click();
  const customers = page.getByRole("dialog", { name: "기존 고객 선택" });
  await customers.getByRole("textbox").fill("Alex");
  await customers.getByRole("button", { name: /Alex Morgan/ }).click();
  await expect(page.locator(".reservation-history tbody tr")).toHaveCount(1);
  for (const width of [800, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
    const dialog = page.getByRole("dialog", { name: "예약", exact: true });
    await expect
      .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
      .toBeTruthy();
  }
  await page.screenshot({
    path: "test-results/reservation-revised-mobile.png",
  });
  await page.getByRole("button", { name: "신규 작성" }).click();
  await expect(page.getByLabel("고객명 *", { exact: true })).toHaveValue("");
  await expect(page.locator(".reservation-config-table tbody tr")).toHaveCount(
    0,
  );
});
