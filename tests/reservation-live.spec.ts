import { expect, test, type Page } from "@playwright/test";
import { demoData } from "../src/lib/demo";
import { hotelDate, addDays } from "../src/lib/domain";
import type { ReservationInput } from "../src/lib/createReservation";

test("청소표 메모 날짜별 저장과 재조회", async ({ page }) => {
  await setup(page, true, false);
  const records = new Map<string, { notes: string; defects: string }>();
  await page.route("**/rest/v1/housekeeping_notes?**", route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("property_id")).toBe("eq.1");
    const value = records.get(url.searchParams.get("business_date")!.slice(3));
    return route.fulfill({ json: value ? [value] : [] });
  });
  await page.route("**/rpc/pms_save_housekeeping_notes", route => {
    const body = route.request().postDataJSON();
    expect(body.p_property_id).toBe(1);
    records.set(body.p_business_date, { notes: body.p_notes, defects: body.p_defects });
    return route.fulfill({ status: 204 });
  });
  await page.getByRole("button", { name: "예약 창 닫기", exact: true }).click();
  await page.goto("/#/housekeeping/cleaning");
  const panel = page.locator(".work-panel:not([hidden])");
  await panel.getByLabel("청소표 특이사항").fill("추가 청소 요청");
  await panel.getByLabel("청소표 고장 목록").fill("301호 에어컨");
  await panel.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(panel.getByText("메모를 저장했습니다.", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "다음 영업일" }).click();
  await expect(panel.getByLabel("청소표 특이사항")).toHaveValue("");
  await panel.getByRole("button", { name: "이전 영업일" }).click();
  await expect(panel.getByLabel("청소표 특이사항")).toHaveValue("추가 청소 요청");
  await expect(panel.getByLabel("청소표 고장 목록")).toHaveValue("301호 에어컨");
});

test("청소상태 수동 변경 저장과 오류 처리", async ({ page }) => {
  await setup(page, true, false);
  await page.getByRole("button", { name: "예약 창 닫기", exact: true }).click();
  let dirty = false;
  let attempts = 0;
  await page.route("https://pms-test.supabase.co/rest/v1/room?**", route => route.fulfill({ json: demoData.rooms.map(r => r.room_id === 1 ? { ...r, housekeeping_status: dirty ? "미정비" : "정비완료" } : r) }));
  await page.route("**/rpc/pms_update_housekeeping", async route => {
    expect(route.request().postDataJSON()).toEqual({ p_room_id: 1, p_status: dirty ? "정비완료" : "미정비" });
    if (++attempts === 3) { await route.fulfill({ status: 400, json: { message: "변경 권한 없음" } }); return; }
    dirty = !dirty;
    await route.fulfill({ status: 204 });
  });
  await page.goto("/#/housekeeping/cleaning");
  const panel = page.locator(".work-panel:not([hidden])");
  await panel.getByRole("button", { name: /^301호/ }).click();
  const tile = panel.getByRole("button", { name: /^301호/ });
  await expect(tile).toContainText("미정비");
  await expect(panel.locator(".hk-selected")).toContainText("선택일 상태: 미정비");
  await expect(panel.getByRole("button", { name: /^301호/ })).toBeVisible();
  await tile.click();
  await expect(tile).toContainText("공실");
  await expect(panel.locator(".hk-selected")).toContainText("선택일 상태: 공실");
  await tile.click();
  await expect(panel.getByRole("alert")).toContainText("변경 권한 없음");
  await expect(panel.locator(".hk-selected")).toContainText("선택일 상태: 공실");
});

test("청소표 운영 조회의 호텔·월 범위와 조회 실패 표시", async ({ page }) => {
  await setup(page, true, false);
  await page.getByRole("button", { name: "예약 창 닫기", exact: true }).click();
  const queries: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/rest/v1/")) queries.push(url);
  });
  await page.goto("/#/housekeeping/cleaning");
  const panel = page.locator(".work-panel:not([hidden])");
  await expect(panel.locator(".hk-grid")).toBeVisible();
  expect(
    queries.some(
      (url) =>
        url.pathname.endsWith("/room") &&
        url.searchParams.get("property_id") === "eq.1",
    ),
  ).toBe(true);
  expect(
    queries.some(
      (url) =>
        url.pathname.endsWith("/reservation_room") &&
        url.searchParams.get("reservation.property_id") === "eq.1" &&
        url.searchParams.get("reservation.check_out") ===
          `gte.${hotelDate().slice(0, 7)}-01`,
    ),
  ).toBe(true);
  await page.route("https://pms-test.supabase.co/rest/v1/room?**", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "청소표 테스트 조회 오류" },
    }),
  );
  await panel.getByRole("button", { name: "청소표 새로고침" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "청소표 테스트 조회 오류",
  );
  await expect(panel.locator(".hk-grid")).toHaveCount(0);
});

test("선택 객실 부분 퇴실과 마지막 객실 퇴실 후 화면 갱신", async ({
  page,
}) => {
  await setup(page, true, false, true);
  await page.getByRole("button", { name: "예약 창 닫기", exact: true }).click();
  await page
    .locator(".work-panel:not([hidden]) .timeline-toolbar")
    .getByRole("button", { name: "퇴실", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "퇴실", exact: true });
  await dialog.getByRole("button", { name: "투숙객", exact: true }).click();
  await dialog
    .locator(".checkout-bookings > button")
    .filter({ hasText: "김하늘" })
    .click();
  await dialog.getByRole("checkbox").first().check();
  await dialog
    .getByRole("button", { name: "선택 객실 퇴실", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("1실 퇴실 처리");
  await expect(dialog.getByRole("checkbox").first()).toBeDisabled();
  await expect(dialog.locator(".checkout-info")).toContainText("재실");
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog
    .getByRole("button", { name: "선택 객실 퇴실", exact: true })
    .click();
  await expect(dialog.locator(".checkout-info")).toContainText("퇴실");
  await expect(dialog.getByRole("checkbox").nth(1)).toBeDisabled();
  await expect(
    dialog.locator(".checkout-bookings > button").filter({ hasText: "김하늘" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "퇴실 창 닫기" }).click();
  await page.goto("/#/express/checked-out");
  const panel = page.locator(".work-panel:not([hidden])");
  await expect(panel.getByLabel("퇴실 시작일")).toHaveValue(hotelDate());
  await panel.getByLabel("퇴실 종료일").fill(addDays(hotelDate(), 1));
  await panel.getByRole("button", { name: "조회", exact: true }).click();
  await expect(
    panel.locator("tbody tr").filter({ hasText: "김하늘" }),
  ).toHaveCount(1);
  await panel.getByLabel("고객명", { exact: true }).fill("없는고객");
  await panel.getByRole("button", { name: "조회", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(0);
});

async function setup(
  page: Page,
  anonymous: boolean,
  withRates: boolean,
  todayFixture = false,
) {
  const fixture = structuredClone(demoData);
  if (todayFixture) {
    fixture.reservations[0].check_in = hotelDate();
    fixture.reservations[0].check_out = addDays(hotelDate(), 1);
    fixture.reservationRooms[1].reservation_id =
      fixture.reservations[0].reservation_id;
  }
  const tables: Record<string, unknown[]> = {
    property: demoData.properties,
    customer: [...demoData.customers],
    partner: demoData.partners,
    room_type: demoData.roomTypes,
    room: demoData.rooms,
    reservation: fixture.reservations,
    reservation_room: fixture.reservationRooms,
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
    if (url.pathname.endsWith("/rpc/pms_check_out_rooms")) {
      const payload = route.request().postDataJSON();
      const booking = fixture.reservations.find(
        (r) => r.reservation_id === payload.p_reservation_id,
      )!;
      for (const line of fixture.reservationRooms.filter((r) =>
        payload.p_room_ids.includes(r.reservation_room_id),
      )) {
        line.stay_status = "퇴실";
      }
      booking.status = fixture.reservationRooms.some(
        (r) =>
          r.reservation_id === booking.reservation_id &&
          r.stay_status === "재실",
      )
        ? "재실"
        : "퇴실";
      await route.fulfill({ status: 204 });
      return;
    }
    if (
      url.pathname.endsWith("/rpc/pms_check_in_room") ||
      url.pathname.endsWith("/rpc/pms_cancel_check_in_room")
    ) {
      const cancel = url.pathname.endsWith("/rpc/pms_cancel_check_in_room");
      const id = route.request().postDataJSON().p_reservation_room_id;
      const rooms = tables.reservation_room as {
        reservation_room_id: number;
        reservation_id: number;
        stay_status: string;
      }[];
      const line = rooms.find((r) => r.reservation_room_id === id)!;
      line.stay_status = cancel ? "예약" : "재실";
      const reservation = (
        tables.reservation as { reservation_id: number; status: string }[]
      ).find((r) => r.reservation_id === line.reservation_id)!;
      reservation.status = rooms.some(
        (r) =>
          r.reservation_id === line.reservation_id && r.stay_status === "재실",
      )
        ? "재실"
        : "예약";
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
  await page.getByRole("button", { name: "자세히", exact: true }).click();
  const checkbox = page.getByRole("checkbox", {
    name: `${type} 선택`,
    exact: true,
  });
  if (await checkbox.isChecked()) {
    const input = page.getByLabel(`${type} 객실 수`, { exact: true });
    await input.fill(String(Number(await input.inputValue()) + 1));
  } else {
    await checkbox.check();
    await page.getByLabel(`${type} 객실 수`, { exact: true }).fill("1");
  }
  await page.getByRole("button", { name: "적용", exact: true }).click();
}
for (const anonymous of [false, true]) {
  test(`요금 연결 계약·자동계산·수량 저장·재시도 (${anonymous ? "개발 모드" : "직원 모드"})`, async ({
    page,
  }) => {
    const requests = await setup(page, anonymous, false);
    await page.getByLabel("고객명 *", { exact: true }).fill("예약 고객 테스트");
    await page.getByLabel("입실일 *", { exact: true }).fill(hotelDate());
    await page
      .getByLabel("퇴실일 *", { exact: true })
      .fill(addDays(hotelDate(), 3));
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
    await page
      .getByLabel("퇴실일 *", { exact: true })
      .fill(addDays(hotelDate(), 2));
    await expect(page.locator(".reservation-grand-total")).toContainText(
      "550,000원",
    );
    await page
      .getByLabel("퇴실일 *", { exact: true })
      .fill(addDays(hotelDate(), 3));
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
    expect(requests[1].p_payload.customer_id).toBe(null);
    expect(requests[1].p_payload.customer_name).toBe("예약 고객 테스트");
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
      "입실 취소",
    );
    await expect(detail.locator(".detail-card").nth(1)).toContainText("예약");
    await expect(
      detail
        .getByRole("button", { name: "미배정호 입실", exact: true })
        .first(),
    ).toBeDisabled();
  });
}
test("당일 입실 취소는 객실별로 되돌리고 마지막 취소 시 예약 전체도 되돌린다", async ({
  page,
}) => {
  await setup(page, true, false, true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "예약", exact: true }),
  ).not.toBeVisible();
  await page.goto("/#/express/reservations");
  await page.getByRole("button", { name: "TS-2609-0001", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "예약 상세", exact: true });
  await expect(
    detail.getByRole("button", { name: /호 입실 취소$/ }),
  ).toHaveCount(2);
  const first = detail.getByRole("button", {
    name: "301호 입실 취소",
    exact: true,
  });
  await expect(first).toHaveClass(/danger/);
  await first.click();
  await expect(detail.getByRole("status")).toContainText(
    "입실이 취소되었습니다",
  );
  await expect(detail.locator(".detail-heading .badge")).toHaveText("재실");
  await expect(
    detail.getByRole("button", { name: "301호 입실", exact: true }),
  ).toBeEnabled();
  await detail
    .getByRole("button", { name: "302호 입실 취소", exact: true })
    .click();
  await expect(detail.locator(".detail-heading .badge")).toHaveText("예약");
  await expect(
    detail.getByRole("button", { name: /호 입실 취소$/ }),
  ).toHaveCount(0);
  await detail.getByRole("button", { name: "301호 입실", exact: true }).click();
  await expect(
    detail.getByRole("button", { name: "301호 입실 취소", exact: true }),
  ).toBeEnabled();
  await detail
    .getByRole("button", { name: "예약 상세 닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "TS-2609-0003", exact: true }).click();
  await expect(
    detail.getByRole("button", { name: /호 입실 취소$/ }),
  ).toHaveCount(0);
  await expect(
    detail.getByRole("button", { name: "303호 입실", exact: true }),
  ).toBeDisabled();
});

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
