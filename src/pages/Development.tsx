import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";
const schema = [
  ["property", "호텔", "—"],
  ["room_type", "객실타입", "property"],
  ["room", "객실", "property, room_type"],
  ["customer", "고객", "—"],
  ["partner", "거래처", "—"],
  ["reservation", "예약", "property, customer, partner"],
  ["reservation_room", "예약객실", "reservation, room_type, room"],
  ["reservation_ref", "예약번호", "reservation"],
  ["charge_item", "부대항목", "property"],
  ["reservation_charge", "부대 이용내역", "reservation, charge_item"],
  ["payment", "결제", "reservation, partner"],
  ["rate_type", "요금타입", "property"],
];
export function Development({ id }: { id: string }) {
  if (id === "schema")
    return (
      <>
        <div className="info-banner">
          요금타입은 호텔에 연결되어 있습니다. 예약객실과의 연결 컬럼은 아직
          추가되지 않았습니다.
        </div>
        <div className="schema-flow">
          <span>호텔</span>
          <b>→</b>
          <span>예약</span>
          <b>→</b>
          <span>예약객실 · 이용내역 · 결제</span>
        </div>
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>테이블</th>
                  <th>역할</th>
                  <th>외래 키 참조 대상</th>
                </tr>
              </thead>
              <tbody>
                {schema.map(([name, label, refs]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>{label}</td>
                    <td>{refs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  if (id === "source")
    return (
      <section className="panel">
        <h2>프로젝트 Source</h2>
        <p>DB 및 웹 소스 저장소</p>
        <a
          className="button primary"
          href="https://github.com/west31-d/PMS_DB_sys"
          target="_blank"
          rel="noreferrer"
        >
          GitHub 저장소 열기
        </a>
        <p>
          <a
            href="https://app.notion.com/p/TSH_PMS-project-1b4cc13e79b58392bdf3014776de3dd6"
            target="_blank"
            rel="noreferrer"
          >
            기존 프로젝트 Notion 열기 ↗
          </a>
        </p>
      </section>
    );
  if (id === "wbs")
    return (
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>작업</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["공통 레이아웃·내비게이션", "구현"],
              ["예약·객실 조회 UI", "구현"],
              ["Supabase 로그인·조회 연결 코드", "구현 · 운영 권한 설정 필요"],
              ["예약 등록·체크인·체크아웃", "준비 중"],
              ["일마감·노쇼·알림", "준비 중"],
            ].map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <section className="panel">
      <EmptyState
        title={id === "pt" ? "PT 자료 연결 준비 중" : "Feedback 기능 준비 중"}
        description="이 저장소에는 연결할 기존 자료나 기능이 없습니다."
      />
      <Link className="button" to="/development/source">
        프로젝트 링크 보기
      </Link>
    </section>
  );
}
