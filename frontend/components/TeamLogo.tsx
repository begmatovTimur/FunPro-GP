import { teamLogo } from "@/lib/teams";

/** Team logo; falls back to a colour dot for drivers without a team (older accounts). */
export default function TeamLogo({ team, color, size = 22, title }: { team?: string | null; color?: string; size?: number; title?: string }) {
  const src = teamLogo(team);
  if (!src) return <span className="team-dot" style={{ background: color ?? "#666", width: size * 0.8, height: size * 0.8 }} title={title} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={title ?? team ?? ""} title={title} width={size} height={size} className="team-logo" style={{ width: size, height: size }} />;
}
