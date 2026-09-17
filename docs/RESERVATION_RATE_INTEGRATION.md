# 예약 입력과 향후 요금 연결

2026-09-17 실제 Supabase의 `information_schema.columns`와 PK/FK/UNIQUE/CHECK를 조회해 확인했다. 이번 UI 개편에서는 테이블·컬럼·제약조건·기존 데이터·DB 함수 모두 변경하지 않았다. 사용자 결정에 따라 요금 저장 구조는 추후 제공될 때 연결한다.

## 현재 구현

- 우측 상단 예약 버튼 → 중앙 팝업. 왼쪽 예약 정보 / 오른쪽 객실 구성, 부대서비스, Summary, 작은 기존 예약 영역.
- 신규 고객 입력 또는 기존 고객 검색. 기존 고객 선택은 해당 ID를 사용하며 기존 예약을 표시한다.
- 거래처명·타입 검색, 현재 프로퍼티의 객실타입 선택. 같은 타입 재선택은 수량 증가.
- 객실 구성의 **호수 배정** 버튼으로 별도 창에서 방을 선택한다. 선택한 `room_id`를 저장하며 미배정 객실은 `null`이다. 숙박일 변경 시 배정을 초기화하고, 수량 감소 시 뒤쪽 객실의 배정을 제거한다.
- `1박 요금 × 수량 × 숙박일수` 계산, 서비스 포함 총액, 날짜/수량/요금/참조값 검사.
- 사용자가 객실타입별 1박 요금을 직접 입력한다. 빈 값은 저장을 차단하고 명시적으로 입력한 0원은 허용한다. 음수·소수점 2자리 초과·DB 금액 범위 초과는 허용하지 않는다.
- 거래처 변경 시 입력 요금을 유지한다. 수량·숙박일수 변경 시 합계를 재계산한다.
- 요금타입 조회 없이 실제 예약 저장 RPC에 입력 금액을 전달한다. 요금 조회 어댑터는 향후 연결을 위해 보존하지만 현재 화면에서는 호출하지 않는다.

## 실제 DB 매핑

| 입력 | 실제 저장 위치 |
| --- | --- |
| 신규 고객명 / 기존 고객 | `customer.customer_name` 생성 후 ID / 기존 `customer_id` 그대로 사용 |
| 프로퍼티·입퇴실일·상태·메모 | `reservation.property_id, check_in, check_out, status, note` |
| 예약 거래처 | `reservation.booking_partner_id` → `partner.partner_id` |
| 외부 예약번호 | `reservation_ref(ref_type='EXTERNAL', ref_number)` |
| 내부 예약번호 | 기존 트리거 자동 발급 |
| 객실타입·객실 수 | 수량만큼 `reservation_room` 행 생성. 각 행은 `room_type_id` FK, 선택한 `room_id` 또는 `null` |
| 객실 가격 보존 | 각 행의 `rate_amount = 1박 단가 × 숙박일수` |
| 부대서비스 | `reservation_charge(charge_item_id, quantity, unit_price, charged_at)` |

`reservation_room`에 `room_count`와 `rate_type_id`는 없다. STT 2실 + STD 1실은 UI에서는 2행, DB에서는 3행이다. 이 방식은 기존 재고 계산·배정·대시보드와 호환된다. 예약번호·객실타입 이름·거래처 이름·박수·합계 컬럼을 추가하지 않는다.

`rate_type`은 `rate_type_id, property_id, rate_type_name`만 가진다. 거래처, 객실타입, 가격 관계가 없으므로 기존 예약금액이나 이름 문자열로 요금을 추정할 수 없다.

## 요금 데이터가 준비되면 연결할 곳

1. `src/lib/reservationRateSource.ts`의 `loadPartnerRoomRates` 구현을 실제 스키마에 맞춰 교체한다. 테이블명/RPC명/컬럼명은 아직 가정하지 않았다.
2. 입력 계약은 `{ propertyId, partnerId, roomTypeIds, checkIn, checkOut }`이다. 모든 조건에 맞는 요금만 반환해야 한다. 현재 반환은 `{ status: 'not_configured', rates: [] }`이다.
3. 연결 후에는 `{ status: 'ready', rates: [{ room_type_id, rate_type_id, nightly_rate }] }`를 반환한다. 숫자로 변환하고 유한한 음수 아닌 단가인지 검증한다. 현재 계산 계약은 숙박 기간 내 동일한 1박 요금이다. 요금이 날짜마다 다르면 일자별 요금 계약을 별도로 설계해야 한다.
4. 선택한 타입당 적용 요금이 정확히 하나여야 한다. 미등록 타입은 반환하지 않는다. 쿼리 실패는 예외를 던져 재조회 안내를 표시한다. 여러 요금이 적용될 수 있다면 우선순위/요금타입 선택 규칙을 확정해야 하며 임의로 첫 요금을 선택하지 않는다.
5. `src/lib/reservationPricing.ts`가 숙박일수·전체 숙박 금액·수량별 DB 행 변환을 담당한다. 80,000원 × STT 2실 × 3박 → `rate_amount=240000`인 행 2개.
6. **실제 요금 연결 시 기존 저장 RPC도 함께 갱신해야 한다.** 현재 `pms_create_reservation`은 전달된 금액의 범위만 확인한다. 새 요금 원본을 같은 트랜잭션에서 조회하여 요금 존재 여부·변경 여부·거래처/타입/프로퍼티/기간 일치 여부를 서버에서 검증하고 금액을 재계산해야 한다. 프론트 검증만으로 요금 무결성이 보장되지는 않는다. 테이블 구조가 확정되기 전에는 이 SQL을 임의로 작성하지 않았다.
7. 선택된 요금타입의 이력을 예약에도 FK로 보존할 필요가 생기면 별도 스키마 변경 논의가 필요하다. 현재는 실제 금액만 기존 `rate_amount`에 보존한다.

## 저장과 테스트

`NewReservation` → `pricedRooms` → `validateReservation` → `createReservation` → 기존 `pms_create_reservation` RPC 순서다. 신규 고객·예약·객실·서비스 생성은 기존 RPC의 단일 트랜잭션에 속한다. 동일 요청 ID 재시도, 저장 성공 후 목록 갱신, 오류 메시지, PostgreSQL 오류 코드 로깅을 유지한다.

- `npm test`: 날짜, 단가/수량 검증, 누락/중복 요금 차단, STT 2 + STD 1 → 3개 미배정 행, 780,000원 계산.
- 기본 Playwright: 고객/거래처 검색, 타입 중복 병합, 서비스, 팝업 재열기, 모바일, 미등록 요금 차단.
- `PMS_TEST_LIVE=true` Playwright: 화면에서 요금을 직접 입력하여 810,000원 합계, 거래처 변경 시 요금 유지, 기간 변경 재계산, 신규/기존 고객 payload, 호수 배정, 모의 RPC 실패·재시도·목록 반영을 검증한다.
- 요금 미입력 시 저장 요청 차단 및 명시적 0원 입력 시 저장 허용을 검사한다.

실제 요금 원본과 서버측 재검증이 연결되면 DB 트랜잭션 검증에 요금 변경/미등록/타 거래처 요금 사용 실패 및 전체 롤백 사례를 추가해야 한다.
