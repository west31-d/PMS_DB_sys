import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Menu, UserRound, ChevronDown } from "lucide-react";
export function TopHeader({
  group,
  title,
  today,
  email,
  onMenu,
  menuExpanded,
  onAccount,
}: {
  group: string;
  title: string;
  today: string;
  email: string;
  onMenu: () => void;
  menuExpanded: boolean;
  onAccount: () => void;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(false);
  const navigate = useNavigate();
  return (
    <header className="top-header">
      <button
        className="icon-button mobile-menu"
        aria-label={menuExpanded ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={menuExpanded}
        aria-controls="app-sidebar"
        onClick={onMenu}
      >
        <Menu size={20} />
      </button>
      <div className="breadcrumb">
        <span>{group}</span>
        <span>/</span>
        <strong>{title}</strong>
      </div>
      <div className="header-actions">
        <form
          className="global-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/booking/all?q=" + encodeURIComponent(search.trim()));
          }}
        >
          <Search size={17} />
          <input
            aria-label="전체 예약 검색"
            placeholder="예약번호 / 고객명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">검색</button>
        </form>
        <time className="header-date">{today}</time>
        <div className="notification">
          <button
            className="icon-button"
            aria-label="알림"
            aria-expanded={notice}
            onClick={() => setNotice(!notice)}
          >
            <Bell size={19} />
          </button>
          {notice && (
            <div className="popover">
              <strong>알림</strong>
              <p>알림 기능은 준비 중입니다.</p>
              <button className="text-button" onClick={() => setNotice(false)}>
                닫기
              </button>
            </div>
          )}
        </div>
        <button className="account-button" onClick={onAccount}>
          <span className="avatar">
            <UserRound size={16} />
          </span>
          <span>{email ? "내 계정" : "게스트"}</span>
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}
