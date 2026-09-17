import type { ReactNode } from "react";
import { Inbox, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
export function StatusBadge({ status }: { status: string }) {
  const tone =
    (
      {
        공실: "green",
        정비완료: "green",
        재실: "blue",
        예약: "blue",
        미정비: "orange",
        고장: "red",
        취소: "red",
        퇴실: "gray",
      } as Record<string, string>
    )[status] ?? "gray";
  return (
    <span className={"badge " + tone}>
      <i />
      {status}
    </span>
  );
}
export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title = "조회 결과가 없습니다",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>{title}</strong>
    </div>
  );
}
export function StatCard({
  label,
  value,
  to,
  tone,
  icon,
}: {
  label: string;
  value: number;
  to: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <Link to={to} className={"stat-card " + tone}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-bottom">
        <strong>
          {value}
          <small>실</small>
        </strong>
        <ArrowUpRight size={17} />
      </div>
    </Link>
  );
}
