import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, RefreshCw, X, LogIn } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopHeader } from "./components/layout/TopHeader";
import {
  WorkspaceTabs,
  useWorkspaceTabs,
} from "./components/layout/WorkspaceTabs";
import { PageHeader, EmptyState } from "./components/ui";
import { ReservationTable } from "./components/table/ReservationTable";
import { ReservationDrawer } from "./components/reservation/ReservationDrawer";
import { Dashboard } from "./pages/Dashboard";
import { RoomTimeline } from "./pages/RoomTimeline";
import { CheckedIn } from "./pages/CheckedIn";
import "./timeline.css";
import { Rooms } from "./pages/Rooms";
import { pageInfo } from "./navigation";
import { demoData } from "./lib/demo";
import { loadRoomCatalog } from "./lib/roomCatalog";
import { hotelDate, operationalRows, reservationRows } from "./lib/domain";
import { loadDataset, supabase } from "./lib/supabase";
import type { Dataset, ReservationRow } from "./lib/types";

function AccountDialog({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: Session | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      aria-label="계정"
      className="account-dialog"
      ref={ref}
      onCancel={onClose}
    >
      <div className="section-header">
        <h2>{session ? "내 계정" : "Supabase 로그인"}</h2>
        <button
          className="icon-button"
          aria-label="계정 창 닫기"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {!supabase ? (
        <p>
          현재 로그인 연결 전입니다. 실제 연결 방법은 README의 환경변수 설정을
          참고하세요.
        </p>
      ) : session ? (
        <>
          <p>{session.user.email}</p>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase!.auth.signOut();
                if (error) throw error;
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "로그아웃 실패");
              } finally {
                setBusy(false);
              }
            }}
          >
            로그아웃
          </button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { error } = await supabase!.auth.signInWithPassword({
                email,
                password,
              });
              if (error) throw error;
              setPassword("");
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "로그인 실패");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="muted">등록된 직원 계정으로 로그인하세요.</p>
          <label>
            이메일
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary full" disabled={busy}>
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </dialog>
  );
}
const pending: Record<string, string> = {
  "checked-out":
    "실 퇴실 기록 기능을 준비하고 있습니다. 퇴실 예정 목록에서 예약을 확인하세요.",
  "no-show": "노쇼 관리 기능을 준비하고 있습니다.",
  cards: "등록 카드 양식과 출력 기능은 준비 중입니다.",
  closing:
    "일마감 기능을 준비하고 있습니다. 폴리오에서 예약별 이용·결제 내역을 확인하세요.",
};
function Workspace({
  viewLocation,
  active,
  data,
  propertyId,
  day,
  onDayChange,
  live,
  onSelect,
}: {
  viewLocation: { pathname: string; search: string };
  active: boolean;
  data: Dataset;
  propertyId: number;
  day: string;
  onDayChange: (day: string) => void;
  live: boolean;
  onSelect: (r: ReservationRow) => void;
}) {
  const location = viewLocation,
    info = pageInfo(location.pathname),
    rows = reservationRows(data, propertyId),
    q = new URLSearchParams(location.search).get("q") ?? "";
  if (info.id === "checked-in")
    return (
      <CheckedIn
        key={propertyId}
        data={data}
        propertyId={propertyId}
        live={live}
        active={active}
      />
    );
  if (info.id === "dashboard")
    return (
      <RoomTimeline
        key={propertyId}
        data={data}
        rows={rows}
        propertyId={propertyId}
        day={day}
        onDayChange={onDayChange}
        onSelect={onSelect}
      />
    );
  if (info.id === "overview")
    return (
      <Dashboard
        data={data}
        rows={rows}
        propertyId={propertyId}
        day={day}
        onSelect={onSelect}
      />
    );
  if (["available", "cleaning", "out-of-order"].includes(info.id))
    return (
      <Rooms
        key={info.id}
        data={data}
        propertyId={propertyId}
        day={day}
        mode={info.id}
      />
    );
  if (pending[info.id])
    return (
      <section className="panel">
        <EmptyState title="기능 준비 중" description={pending[info.id]} />
        <Link className="button" to="/booking/all">
          예약 목록으로 이동
        </Link>
      </section>
    );
  if (info.id === "not-found")
    return <EmptyState title="페이지를 찾을 수 없습니다" />;
  return (
    <>
      <ReservationTable
        key={location.pathname + q + propertyId}
        rows={operationalRows(rows, info.id, day)}
        onSelect={onSelect}
        initialSearch={q}
      />
    </>
  );
}
export default function App() {
  const { tabs, day, setDay, close, activate } = useWorkspaceTabs();
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 960px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const location = useLocation(),
    info = pageInfo(location.pathname);
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [account, setAccount] = useState(false);
  const [mode, setMode] = useState<"demo" | "live" | "snapshot">(
      import.meta.env.VITE_DEMO_MODE === "true"
        ? "demo"
        : supabase
          ? "live"
          : "snapshot",
    ),
    [session, setSession] = useState<Session | null>(null);

  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [propertyId, setPropertyId] = useState(1),
    [selected, setSelected] = useState<ReservationRow | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        if (error) setError(error.message);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    setSelected(null);
    setError("");
    if (mode === "demo") {
      setData(demoData);
      setLoading(false);
      setPropertyId(1);
      return;
    }
    setData(null);
    if (mode === "live" && !session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const request =
      mode === "snapshot"
        ? loadRoomCatalog().then((snapshot) => {
            return snapshot.data;
          })
        : loadDataset();
    request
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setPropertyId((old) =>
            next.properties.some((p) => p.property_id === old)
              ? old
              : (next.properties[0]?.property_id ?? 0),
          );
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, session, revision]);
  useEffect(() => {
    setSelected(null);
    setMobile(false);
  }, [location.pathname, propertyId]);
  const known = info.id !== "not-found";
  return (
    <div
      data-mode={mode}
      className={
        "app " +
        (collapsed ? "is-collapsed " : "") +
        (mobile ? "mobile-open" : "")
      }
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          if (window.matchMedia("(max-width: 960px)").matches) setMobile(false);
          else setCollapsed(!collapsed);
        }}
        onNavigate={() => {
          setMobile(false);
          setCollapsed(true);
        }}
      />
      <button
        className="sidebar-scrim"
        tabIndex={mobile ? 0 : -1}
        aria-hidden={!mobile}
        aria-label="메뉴 닫기"
        onClick={() => setMobile(false)}
      />
      <div className="workspace">
        <TopHeader
          group={info.group}
          title={info.title}
          today={hotelDate()}
          email={session?.user.email ?? ""}
          menuExpanded={narrow ? mobile : !collapsed}
          onMenu={() => {
            if (narrow) {
              setCollapsed(false);
              setMobile((v) => !v);
            } else setCollapsed((v) => !v);
          }}
          onAccount={() => setAccount(true)}
        />
        <WorkspaceTabs
          tabs={tabs}
          activePath={location.pathname}
          onActivate={activate}
          onClose={close}
        />

        <main id="main-content">
          <PageHeader title={info.title}>
            {data && data.properties.length > 0 && (
              <select
                aria-label="호텔 선택"
                value={propertyId}
                onChange={(e) => setPropertyId(Number(e.target.value))}
              >
                {data.properties.map((p) => (
                  <option key={p.property_id} value={p.property_id}>
                    {p.property_name}
                  </option>
                ))}
              </select>
            )}
            {mode === "demo" && <span className="badge gray">데모</span>}
            {supabase && <button className="button" onClick={()=>setMode(mode === "demo" ? "live" : "demo")}>{mode === "demo" ? "운영 화면" : "데모"}</button>}
            {[
              "dashboard",
              "overview",
              "arrivals",
              "departures",
              "available",
            ].includes(info.id) && (
              <label className="date-picker">
                <CalendarDays size={16} />
                <span className="sr-only">조회 기준일</span>
                <input
                  aria-label="조회 기준일"
                  type="date"
                  value={day}
                  onChange={(e) => {
                    if (e.target.value) setDay(e.target.value);
                  }}
                />
              </label>
            )}
            <button
              className="button"
              disabled={loading}
              onClick={() => setRevision((r) => r + 1)}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              새로고침
            </button>
          </PageHeader>

          {error ? (
            <div className="error-panel" role="alert">
              <h2>데이터를 불러오지 못했습니다</h2>
              <p>{error}</p>
              <p>
                로그인 계정의 테이블 조회 권한과 RLS 정책을 확인하세요. 샘플
                데이터로 자동 대체하지 않습니다.
              </p>
              <button
                className="button"
                onClick={() => setRevision((r) => r + 1)}
              >
                다시 시도
              </button>
            </div>
          ) : loading ? (
            <div className="loading" role="status">
              <RefreshCw className="spin" /> 운영 데이터를 불러오는 중입니다…
            </div>
          ) : mode === "live" && !session ? (
            <section className="panel">
              <EmptyState
                title="직원 계정으로 로그인하세요"
                description="호텔 운영 데이터는 로그인 후 조회할 수 있습니다."
              />
              <button
                className="button primary"
                onClick={() => setAccount(true)}
              >
                <LogIn size={16} />
                로그인
              </button>
            </section>
          ) : data && !data.properties.length ? (
            <EmptyState
              title="조회 가능한 호텔이 없습니다"
              description="호텔 데이터와 계정의 조회 권한을 확인하세요."
            />
          ) : data ? (
            <>
              {location.pathname === "/" && (
                <Navigate to="/express/dashboard" replace />
              )}
              {tabs.map((tab) => (
                <section
                  key={tab.path + propertyId + mode + (session?.user.id ?? "")}
                  id={"work-panel-" + tab.path}
                  role="tabpanel"
                  aria-labelledby={"work-tab-" + tab.path}
                  hidden={tab.path !== location.pathname}
                  className="work-panel"
                >
                  <Workspace
                    viewLocation={{ pathname: tab.path, search: tab.search }}
                    active={tab.path === location.pathname}
                    data={data}
                    propertyId={propertyId}
                    day={tab.day}
                    onDayChange={setDay}
                    live={mode === "live"}
                    onSelect={setSelected}
                  />
                </section>
              ))}
              {!known && location.pathname !== "/" && (
                <EmptyState
                  title="페이지를 찾을 수 없습니다"
                  description="왼쪽 메뉴에서 이동해 주세요."
                />
              )}
            </>
          ) : null}
        </main>
      </div>
      {data && (
        <ReservationDrawer
          row={selected}
          data={data}
          onClose={() => setSelected(null)}
        />
      )}
      <AccountDialog
        open={account}
        session={session}
        onClose={() => setAccount(false)}
      />
    </div>
  );
}
