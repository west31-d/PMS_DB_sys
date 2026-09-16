import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, LayoutDashboard } from "lucide-react";
import { pageInfo } from "../../navigation";
import { hotelDate } from "../../lib/domain";
const home = "/express/dashboard";
export interface WorkTab {
  path: string;
  search: string;
  day: string;
}
export function useWorkspaceTabs() {
  const location = useLocation(),
    navigate = useNavigate();
  const [tabs, setTabs] = useState<WorkTab[]>([
    { path: home, search: "", day: hotelDate() },
  ]);
  useEffect(() => {
    if (pageInfo(location.pathname).id === "not-found") return;
    setTabs((old) =>
      old.some((t) => t.path === location.pathname)
        ? old.map((t) =>
            t.path === location.pathname && t.search !== location.search
              ? { ...t, search: location.search }
              : t,
          )
        : [
            ...old,
            {
              path: location.pathname,
              search: location.search,
              day: hotelDate(),
            },
          ],
    );
  }, [location.pathname, location.search]);
  const current = tabs.find((t) => t.path === location.pathname);
  function close(path: string) {
    if (path === home) return;
    const index = tabs.findIndex((t) => t.path === path);
    const remaining = tabs.filter((t) => t.path !== path);
    setTabs(remaining);
    if (location.pathname === path) {
      const next = remaining[Math.max(0, index - 1)] ?? remaining[0];
      navigate(next.path + next.search);
    }
  }
  function setDay(day: string) {
    setTabs((old) =>
      old.map((t) => (t.path === location.pathname ? { ...t, day } : t)),
    );
  }
  return {
    tabs,
    day: current?.day ?? hotelDate(),
    setDay,
    close,
    activate: (tab: WorkTab) => navigate(tab.path + tab.search),
  };
}
export function WorkspaceTabs({
  tabs,
  activePath,
  onActivate,
  onClose,
}: {
  tabs: WorkTab[];
  activePath: string;
  onActivate: (tab: WorkTab) => void;
  onClose: (path: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activePath, tabs.length]);
  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="열린 업무 화면"
      ref={ref}
    >
      {tabs.map((tab, index) => {
        const info = pageInfo(tab.path);
        const label = info.id === "overview" ? "예약 대시보드" : info.title;
        return (
          <div
            className={"work-tab " + (activePath === tab.path ? "active" : "")}
            key={tab.path}
          >
            <button
              type="button"
              id={"work-tab-" + tab.path}
              role="tab"
              aria-selected={activePath === tab.path}
              aria-controls={"work-panel-" + tab.path}
              tabIndex={activePath === tab.path ? 0 : -1}
              onClick={() => onActivate(tab)}
              onKeyDown={(e) => {
                let next = index;
                if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
                else if (e.key === "ArrowLeft")
                  next = (index - 1 + tabs.length) % tabs.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = tabs.length - 1;
                else if (e.key === "Delete") {
                  onClose(tab.path);
                  return;
                } else return;
                e.preventDefault();
                onActivate(tabs[next]);
                ref.current
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }}
            >
              {tab.path === home && <LayoutDashboard size={14} />}
              <span>{label}</span>
            </button>
            {tab.path !== home && (
              <button
                className="work-tab-close"
                type="button"
                aria-label={label + " 탭 닫기"}
                onClick={() => onClose(tab.path)}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
