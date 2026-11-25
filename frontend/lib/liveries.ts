/** Race-suit colours per team (for the podium figures). Original, simplified liveries. */
export interface Livery {
  suit: string; // main suit colour
  accent: string; // side stripes, belt
  accent2: string; // small details
  helmet: string;
  helmetStripe: string;
  text: string; // colour of the number on the chest
  badge?: string; // background of the logo badges (dark for white logos)
}

export const LIVERIES: Record<string, Livery> = {
  mercedes: { suit: "#16171b", accent: "#27f4d2", accent2: "#c9ced3", helmet: "#c9ced3", helmetStripe: "#27f4d2", text: "#ffffff" },
  ferrari: { suit: "#d8001f", accent: "#ffd800", accent2: "#ffffff", helmet: "#e8002d", helmetStripe: "#ffd800", text: "#ffffff" },
  mclaren: { suit: "#ff8000", accent: "#1b1b1f", accent2: "#47c7fc", helmet: "#ff8000", helmetStripe: "#1b1b1f", text: "#1b1b1f" },
  "red-bull-racing": { suit: "#1b2a5c", accent: "#e10600", accent2: "#ffcc00", helmet: "#1b2a5c", helmetStripe: "#ffcc00", text: "#ffffff" },
  "aston-martin": { suit: "#00594f", accent: "#cedc00", accent2: "#ffffff", helmet: "#00594f", helmetStripe: "#cedc00", text: "#ffffff", badge: "#0a2e29" },
  alpine: { suit: "#0067b9", accent: "#ff87bc", accent2: "#ffffff", helmet: "#0067b9", helmetStripe: "#ff87bc", text: "#ffffff" },
  williams: { suit: "#041e42", accent: "#37bedd", accent2: "#ffffff", helmet: "#ffffff", helmetStripe: "#37bedd", text: "#ffffff" },
  haas: { suit: "#f2f2f2", accent: "#e10600", accent2: "#1b1b1f", helmet: "#f2f2f2", helmetStripe: "#e10600", text: "#1b1b1f" },
  "racing-bulls": { suit: "#f4f6fb", accent: "#1634cc", accent2: "#e10600", helmet: "#1634cc", helmetStripe: "#f4f6fb", text: "#1634cc" },
  audi: { suit: "#2b2c30", accent: "#f50537", accent2: "#c9ced3", helmet: "#c9ced3", helmetStripe: "#f50537", text: "#ffffff" },
  cadillac: { suit: "#111114", accent: "#ffffff", accent2: "#b8bcc2", helmet: "#111114", helmetStripe: "#ffffff", text: "#ffffff", badge: "#2a2b31" },
};

export function liveryFor(team: string | null | undefined, fallbackColor = "#e10600"): Livery {
  return (team && LIVERIES[team]) || {
    suit: fallbackColor, accent: "#ffffff", accent2: "#1b1b1f", helmet: fallbackColor, helmetStripe: "#ffffff", text: "#ffffff",
  };
}
