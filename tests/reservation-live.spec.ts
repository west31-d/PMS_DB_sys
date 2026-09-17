import { expect, test, type Page } from "@playwright/test";
import { demoData } from "../src/lib/demo";
import type { ReservationInput } from "../src/lib/createReservation";

async function setup(page: Page, anonymous: boolean, withRates: boolean) {
  const tables: Record<string, unknown[]> = {
    property: demoData.properties,
    customer: [...demoData.customers],
    partner: demoData.partners,
    room_type: demoData.roomTypes,
    room: demoData.rooms,
    reservation: [...demoData.reservations],
    reservation_room: [...demoData.reservationRooms],
    reservation_ref: [...demoData.refs],
    payment: demoData.payments,
    reservation_charge: [...demoData.charges],
    charge_item: demoData.chargeItems,
    rate_type: [
      { rate_type_id: 1, property_id: 1, rate_type_name: "테스트 요금" },
    ],
  };
  const requests: { p_request_id: string; p_payload: ReservationInput }[] = [];
  if (!anonymous)
    await page.addInitScript(() =>
      localStorage.setItem(
        "sb-pms-test-auth-token",
        JSON.stringify({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: "91700000-0000-4000-8000-000000000001",
            email: "test@example.invalid",
            aud: "authenticated",
          },
        }),
      ),
    );
  // Test-only provider substitution. Production has no fabricated rate source.
  if (withRates)
    await page.route("**/src/lib/reservationRateSource.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
    export async function loadPartnerRoomRates(request) {
      await new Promise(resolve => setTimeout(resolve, request.partnerId === 2 ? 300 : 20));
      return { status: "ready", rates: request.roomTypeIds.map(id => ({ room_type_id: id, rate_type_id: 1, nightly_rate: (id === 1 ? 80000 : 100000) + (request.partnerId === 2 ? 10000 : 0) })) };
    }
  `,
      }),
    );
  await page.route("https://pms-test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/rpc/pms_development_mode")) {
      await route.fulfill({ json: anonymous });
      return;
    }
    if (url.pathname.endsWith("/rpc/pms_check_in_room")) {
      const id = route.request().postDataJSON().p_reservation_room_id;
      const rooms = tables.reservation_room as {
        reservation_room_id: number;
        reservation_id: number;
        stay_status: string;
      }[];
      const line = rooms.find((r) => r.reservation_room_id === id)!;
      line.stay_status = "재실";
      const reservation = (
        tables.reservation as { reservation_id: number; status: string }[]
      ).find((r) => r.reservation_id === line.reservation_id)!;
      reservation.status = "재실";
      await route.fulfill({ status: 204 });
      return;
    }
    if (url.pathname.endsWith("/rpc/pms_create_reservation")) {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (requests.length === 1) {
        await route.fulfill({
          status: 400,
          json: { code: "P0001", message: "저장 검증 오류" },
        });
        return;
      }
      const input = body.p_payload as ReservationInput;
      const customerId = input.customer_id ?? 2001;
      if (!input.customer_id)
        tables.customer.push({
          customer_id: customerId,
          customer_name: input.customer_name,
        });
      tables.reservation.push({
        reservation_id: 2001,
        property_id: input.property_id,
        customer_id: customerId,
        booking_partner_id: input.booking_partner_id,
        check_in: input.check_in,
        check_out: input.check_out,
        status: "예약",
        note: input.note,
      });
      tables.reservation_ref.push({
        reservation_id: 2001,
        ref_type: "INTERNAL",
        ref_number: "TEST-SAVED-2001",
      });
      input.rooms.forEach((r, i) =>
        tables.reservation_room.push({
          reservation_room_id: 2001 + i,
          reservation_id: 2001,
          stay_status: "예약",
          ...r,
        }),
      );
      await route.fulfill({
        json: { reservation_id: 2001, reference: "TEST-SAVED-2001" },
      });
      return;
    }
    await route.fulfill({
      json: tables[url.pathname.split("/").at(-1) ?? ""] ?? [],
    });
  });
  await page.goto("/");
  await page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "예약", exact: true })
    .click();
  return requests;
}
async function choosePartner(page: Page, name: string) {
  await page.getByRole("button", { name: "예약 거래처 선택" }).click();
  await page
    .getByRole("dialog", { name: "거래처 선택", exact: true })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
async function addType(page: Page, type: string) {
  await page.getByRole("button", { name: "객실 추가", exact: true }).click();
  await page
    .getByRole("dialog", { name: "객실타입 선택" })
    .getByRole("button", { name: new RegExp(type) })
    .click();
}
for (const anonymous of [false, true]) {
  test(`요금 연결 계약·자동계산·수량 저장·재시도 (${anonymous ? "개발 모드 신규 고객" : "직원 기존 고객"})`, async ({
    page,
  }) => {
    const requests = await setup(page, anonymous, false);
    if (anonymous)
      await page
        .getByLabel("고객명 *", { exact: true })
        .fill("신규 고객 테스트");
    else {
      await page
        .getByRole("button", { name: "기존 고객", exact: true })
        .click();
      await page.getByRole("button", { name: "기존 고객 검색" }).click();
      await page
        .getByRole("dialog", { name: "기존 고객 선택" })
        .getByRole("button", { name: /김하늘/ })
        .click();
    }
    await page.getByLabel("입실일 *", { exact: true }).fill("2026-09-17");
    await page.getByLabel("퇴실일 *", { exact: true }).fill("2026-09-20");
    await choosePartner(page, "아고다");
    for (const type of ["STT", "STT", "STD"]) await addType(page, type);
    await page.getByLabel("STT 1박 요금", { exact: true }).fill("80000");
    await page.getByLabel("STD 1박 요금", { exact: true }).fill("100000");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "780,000원",
    );
    await page
      .getByRole("button", { name: "부대서비스 추가", exact: true })
      .click();
    await page.getByLabel("서비스 1 수량").fill("2");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "810,000원",
    );
    await choosePartner(page, "한진");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "810,000원",
    );
    await choosePartner(page, "아고다");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "810,000원",
    );
    await page.getByLabel("퇴실일 *", { exact: true }).fill("2026-09-19");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "550,000원",
    );
    await page.getByLabel("퇴실일 *", { exact: true }).fill("2026-09-20");
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "810,000원",
    );
    await page
      .getByRole("button", { name: "STT 호수 배정", exact: true })
      .click();
    const assignment = page.getByRole("dialog", {
      name: "객실 배정",
      exact: true,
    });
    const candidate = assignment.locator(".assignment-room").first();
    const number = await candidate.locator("strong").innerText();
    const assignedRoomId = demoData.rooms.find(
      (room) => room.room_number === number && room.room_type_id === 1,
    )!.room_id;
    await candidate.click();
    await assignment
      .getByRole("button", { name: "배정 적용", exact: true })
      .click();
    await page.getByRole("button", { name: "예약 저장", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("저장 검증 오류");
    await page
      .getByRole("button", { name: "예약 저장", exact: true })
      .dblclick();
    await expect(page.getByRole("status")).toContainText("TEST-SAVED-2001");
    expect(requests).toHaveLength(2);
    expect(requests[0].p_request_id).toBe(requests[1].p_request_id);
    expect(requests[1].p_payload.customer_id).toBe(anonymous ? null : 1);
    expect(requests[1].p_payload.customer_name).toBe(
      anonymous ? "신규 고객 테스트" : null,
    );
    expect(requests[1].p_payload.booking_partner_id).toBe(1);
    expect(requests[1].p_payload.rooms).toEqual([
      { room_type_id: 1, room_id: assignedRoomId, rate_amount: 240000 },
      { room_type_id: 1, room_id: null, rate_amount: 240000 },
      { room_type_id: 2, room_id: null, rate_amount: 300000 },
    ]);
    await expect(
      page.getByRole("button", { name: "저장 완료" }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "예약 목록 보기" }).click();
    await expect(
      page.getByRole("button", { name: "TEST-SAVED-2001", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "TEST-SAVED-2001", exact: true })
      .click();
    const detail = page.getByRole("dialog", { name: "예약 상세", exact: true });
    await detail
      .getByRole("button", { name: `${number}호 입실`, exact: true })
      .click();
    await expect(detail.getByRole("status")).toHaveText("입실 처리되었습니다.");
    await expect(detail.locator(".detail-card").first()).toContainText(
      "입실 완료",
    );
    await expect(detail.locator(".detail-card").nth(1)).toContainText("예약");
    await expect(
      detail
        .getByRole("button", { name: "미배정호 입실", exact: true })
        .first(),
    ).toBeDisabled();
  });
}
test("요금 미입력은 저장을 차단하고 명시적 0원은 허용한다", async ({
  page,
}) => {
  const requests = await setup(page, true, false);
  await page.getByLabel("고객명 *", { exact: true }).fill("요금 미등록 테스트");
  await choosePartner(page, "아고다");
  await addType(page, "STT");
  await expect(page.getByLabel("STT 1박 요금", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "예약 저장", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("외부 예약번호").press("Enter");
  expect(requests).toHaveLength(0);
  await page.getByLabel("STT 1박 요금", { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "예약 저장", exact: true }),
  ).toBeEnabled();
});
