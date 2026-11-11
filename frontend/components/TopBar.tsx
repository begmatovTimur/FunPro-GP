"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Driver } from "@/lib/types";

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
    <div className="driver-chip" title={driver.name}>
      <span className="num" style={{ background: driver.color }}>
        {driver.number}
      </span>
      <span>{driver.code}</span>
    </div>
  );
}

export default function TopBar({ driver }: { driver?: Driver | null }) {
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
        {link("/", "Paddock")}
        {link("/standings", "Standings")}
        {link("/results", "Results")}
      </nav>
      <div className="topbar-right">{driver && <DriverChip driver={driver} />}</div>
    </header>
  );
}
