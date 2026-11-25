"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import type { Driver, Me } from "@/lib/types";
import { logout } from "@/lib/useAuth";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" />
      <span>
        FunPro <b>GP</b>
      </span>
    </Link>
  );
}

export function DriverChip({ driver }: { driver: Driver }) {
  return (
    <div className="driver-chip" title={`${driver.name}${driver.team_name ? ` · ${driver.team_name}` : ""}`}>
      {driver.team && <TeamLogo team={driver.team} size={22} />}
      <span className="num" style={{ background: driver.color }}>
        {driver.number}
      </span>
      <span>{driver.code}</span>
    </div>
  );
}

export default function TopBar({ me }: { me?: Me | null }) {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} className={path === href ? "active" : ""}>
      {label}
    </Link>
  );
  return (
    <header className="topbar">
      <Brand />
      <nav className="nav">
        {me?.role === "admin" ? (
          <>
            {link("/admin", "Race Control")}
            {link("/standings", "Standings")}
            {link("/admin/podium", "Podium")}
          </>
        ) : me?.role === "driver" ? (
          <>
            {link("/", "Paddock")}
            {link("/results", "My results")}
          </>
        ) : null}
      </nav>
      <div className="topbar-right">
        {me?.role === "admin" && (
          <div className="driver-chip">
            <span className="num" style={{ background: "var(--red)", padding: "0 8px" }}>RC</span>
            <span>Race Control</span>
          </div>
        )}
        {me?.driver && <DriverChip driver={me.driver} />}
        {me && (
          <button className="btn btn-sm btn-ghost" onClick={logout}>
            Log out
          </button>
        )}
        {!me && path !== "/login" && (
          <Link className="btn btn-sm btn-red" href="/login">Log in</Link>
        )}
      </div>
    </header>
  );
}
