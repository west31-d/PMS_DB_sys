# ThreeSeven PMS UI 작업 기록

2026-09-16 기준. 기존 저장소에는 웹 프레임워크나 페이지가 없어 React/TypeScript/Vite 웹을 새로 만들었습니다.

## 1. 변경 파일

- package.json, package-lock.json: 웹 실행·빌드·테스트 도구 및 명령 추가. 기존 Supabase CLI 유지.
- .gitignore: 웹 빌드와 브라우저 검증 산출물 제외.
- README.md: 실행, 실제 데이터 연결, 구현 범위와 제한 설명. 기존 Notion 링크 유지.
- 신규 index.html, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts, .env.example.
- 신규 src/ 및 tests/ui.spec.ts: 화면, 데이터 조회, 운영 계산 및 검증.

## 2. 컴포넌트

- Sidebar: 메뉴 그룹, 현재 위치, 접기, 개발 메뉴 구분.
- TopHeader: 예약 검색, 날짜, 알림 준비 중 안내, 계정.
- PageHeader, StatCard, StatusBadge, EmptyState: 공통 화면 요소.
- ReservationTable: 검색, 거래처/상태 필터, 정렬, 페이지 이동.
- ReservationDrawer: 키보드 닫기를 지원하는 예약 상세 모달 패널.
- Dashboard, Rooms, Development: 운영/객실/개발 화면.
- App: 공통 레이아웃, 조회 상태, 호텔 선택, 로그인 UI.

## 3. 경로

HashRouter 신규 도입. 기존 웹 경로는 없었습니다.

- /#/express/*: 익스프레스 대시보드와 예약/객실 목록.
- /#/booking/*: 예약 대시보드, 여행사, OTA, 통합 DB.
- /#/housekeeping/*: 청소표, 고장객실 조회.
- /#/accounting/*: 일마감 준비 중, 폴리오 조회.
- /#/development/*: PT, 테이블 관계 목록, Source, WBS, Feedback.

정확한 23개 메뉴 경로는 src/navigation.ts에서 관리합니다. ML 메뉴는 없습니다.

## 4. 기존 구현 영향

기존 SQL, seed, Supabase 설정, 원격 DB 데이터/권한을 변경하지 않았습니다.
작업 이전에 존재한 미커밋 rate_type 마이그레이션은 그대로 남아 있습니다.
실제 연결은 공개 키와 기존 직원 Auth 계정을 사용합니다. service_role 키는 브라우저에서 사용하지 않습니다.
실제 데이터 연결은 환경변수와 SELECT/RLS 권한 설정 후 검증이 필요합니다.

## 5. 준비 중 기능

- 등록·수정·체크인·체크아웃·고장 등록·결제 입력: 현재 조회 전용.
- 실 입실/실 퇴실, 노쇼, 등록 카드, 일마감: 데이터 기록 및 업무 규칙 미정.
- 알림, PT, Feedback: 연결할 기존 구현이 없어 준비 중 안내.
- 예약객실 요금타입: DB의 rate_type_id 연결이 없어 준비 중 표시.
- 예약 대시보드는 공통 운영 Dashboard를 재사용하며 별도 매출 분석은 없음.
- 날짜 선택은 입퇴실 예정과 가용 객실에 적용. 재실·정비 상태는 현재 값.

## 6. 추천 후속 작업

1. 직원 로그인 계정과 호텔별 SELECT/RLS 권한을 연결하고 실제 조회 확인.
2. 예약 등록·수정 및 체크인/체크아웃 기록을 트랜잭션으로 설계.
3. 예약객실 요금타입 FK와 객실요금의 박당/숙박 전체 의미 확정.
4. 운영 데이터 증가에 맞춰 서버 측 검색·필터·페이지 조회 적용.
5. 노쇼/일마감/등록 카드와 운영 배포 환경 확정.

## 실행 및 검증

- npm run dev: http://127.0.0.1:5173, 기본은 명시적으로 표시된 샘플 데이터.
- npm run build: TypeScript 검사 + 프로덕션 빌드.
- npm test: 한국 날짜, 객실 점유 경계, 호텔 구분, 예약번호 검색.
- npm run test:ui: Chrome에서 주요 동작과 23개 메뉴, 5개 화면 너비 검증.

GitHub 커밋/푸시 및 웹 배포는 수행하지 않았습니다.