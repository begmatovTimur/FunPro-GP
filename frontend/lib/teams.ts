/** Teams a driver can pick. Logos live in public/teams/<id>.png (copied from team-logos/). */
export const TEAMS = [
  { id: "alpine", name: "Alpine", color: "#0093cc" },
  { id: "aston-martin", name: "Aston Martin", color: "#229971" },
  { id: "audi", name: "Audi", color: "#f50537" },
  { id: "cadillac", name: "Cadillac", color: "#c9c9c9" },
  { id: "ferrari", name: "Ferrari", color: "#e8002d" },
  { id: "haas", name: "Haas", color: "#b6babd" },
  { id: "mclaren", name: "McLaren", color: "#ff8000" },
  { id: "mercedes", name: "Mercedes", color: "#27f4d2" },
  { id: "racing-bulls", name: "Racing Bulls", color: "#6692ff" },
  { id: "red-bull-racing", name: "Red Bull Racing", color: "#3671c6" },
  { id: "williams", name: "Williams", color: "#37bedd" },
] as const;

export type TeamId = (typeof TEAMS)[number]["id"];

export function teamLogo(id: string | undefined | null): string | null {
  return id && TEAMS.some((t) => t.id === id) ? `/teams/${id}.png` : null;
}
