import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Hotel,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { groups } from "../../navigation";
export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState<string[]>(["express"]);
  useEffect(() => {
    const active = pathname.split("/")[1];
    setOpen((old) => (old.includes(active) ? old : [...old, active]));
  }, [pathname]);
  return (
    <aside className={"sidebar " + (collapsed ? "collapsed" : "")}>
      <NavLink to="/express/dashboard" className="brand" title="ThreeSeven PMS">
        <span className="brand-icon">
          <Hotel size={23} />
        </span>
        <span>
          THREESEVEN<small>PROPERTY MANAGEMENT</small>
        </span>
      </NavLink>
      <div className="nav-scroll">
        <div className="nav-label">WORKSPACE</div>
        {groups.map((group) => (
          <section key={group.id} className="nav-group">
            <button
              className={
                "group-button " +
                (pathname.startsWith("/" + group.id + "/")
                  ? "group-active"
                  : "")
              }
              aria-expanded={!collapsed && open.includes(group.id)}
              aria-controls={"submenu-" + group.id}
              title={group.label}
              onClick={() => {
                if (collapsed) onToggle();
                setOpen((old) =>
                  old.includes(group.id) && !collapsed
                    ? old.filter((x) => x !== group.id)
                    : [...new Set([...old, group.id])],
                );
              }}
            >
              <group.icon size={19} />
              <span>{group.label}</span>
              <ChevronDown
                size={15}
                className={open.includes(group.id) ? "chevron open" : "chevron"}
              />
            </button>
            <div
              id={"submenu-" + group.id}
              className={
                "submenu " +
                (!collapsed && open.includes(group.id) ? "is-open" : "")
              }
              inert={collapsed || !open.includes(group.id)}
            >
              <div className="submenu-clip">
                <div className="nav-items">
                  {group.items.map(([id, label]) => (
                    <NavLink
                      key={id}
                      to={"/" + group.id + "/" + id}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                      }
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
      <button
        className="sidebar-bottom"
        onClick={onToggle}
        aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
      >
        {collapsed ? (
          <PanelLeftOpen size={19} />
        ) : (
          <>
            <PanelLeftClose size={19} />
            <span>메뉴 접기</span>
            <small>v0.1</small>
          </>
        )}
      </button>
    </aside>
  );
}
