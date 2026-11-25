import { useId } from "react";
import { liveryFor } from "@/lib/liveries";
import { teamLogo } from "@/lib/teams";

/**
 * A chibi race driver in their team's livery, with the team logo on the helmet.
 * `celebrate` raises the arms with a trophy (for the winner).
 */
export default function DriverFigure({
  team,
  color,
  number,
  celebrate = false,
  trophy,
  size = 220,
}: {
  team?: string | null;
  color?: string;
  number?: number | string;
  celebrate?: boolean;
  trophy?: string; // trophy colour when holding one
  size?: number;
}) {
  const L = liveryFor(team, color);
  const logo = teamLogo(team);
  const uid = useId().replace(/:/g, "");
  const shade = "rgba(0,0,0,.18)";

  const badge = L.badge ?? "#fff";

  // Arms down (drawn behind the torso).
  const armDown = (side: -1 | 1) => {
    const x = 110 + side * 54;
    return (
      <g key={side}>
        <path d={`M${x} 166 Q ${x + side * 14} 196 ${x + side * 8} 226`} stroke={L.suit} strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d={`M${x + side * 6} 170 Q ${x + side * 16} 198 ${x + side * 11} 220`} stroke={L.accent} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".9" />
        <circle cx={x + side * 8} cy={230} r="13" fill="#1b1b1f" />
      </g>
    );
  };

  // Arms up in a V beside the helmet (drawn last, in front).
  const armUp = (side: -1 | 1) => {
    const sx = 110 + side * 50, ex = 110 + side * 74, hx = 110 + side * 80;
    const path = `M${sx} 168 Q ${ex} 132 ${hx} 72`;
    return (
      <g key={side}>
        <path d={path} stroke={L.suit} strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d={path} stroke={L.accent} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".9" transform={`translate(${side * -7} 0)`} />
        <circle cx={hx} cy={62} r="13" fill="#1b1b1f" />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 220 300" width={size} height={(size * 300) / 220} aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`hc${uid}`}><circle cx="110" cy="96" r="70" /></clipPath>
        <radialGradient id={`hg${uid}`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`vg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d4a" />
          <stop offset="1" stopColor="#101116" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="110" cy="292" rx="62" ry="7" fill="rgba(0,0,0,.35)" />

      {/* legs + boots */}
      <rect x="76" y="228" width="27" height="44" rx="10" fill={L.suit} />
      <rect x="117" y="228" width="27" height="44" rx="10" fill={L.suit} />
      <rect x="80" y="230" width="5" height="38" rx="2.5" fill={L.accent} opacity=".85" />
      <rect x="135" y="230" width="5" height="38" rx="2.5" fill={L.accent} opacity=".85" />
      <rect x="70" y="266" width="36" height="22" rx="9" fill="#1b1b1f" />
      <rect x="114" y="266" width="36" height="22" rx="9" fill="#1b1b1f" />

      {/* arms behind torso when down */}
      {!celebrate && [armDown(-1), armDown(1)]}

      {/* torso */}
      <path d="M62 170 Q62 150 84 148 L136 148 Q158 150 158 170 L156 236 Q156 244 146 244 L74 244 Q64 244 64 236 Z" fill={L.suit} />
      <path d="M62 170 Q62 150 84 148 L92 148 L84 244 L74 244 Q64 244 64 236 Z" fill={shade} />
      <rect x="64" y="160" width="7" height="78" rx="3.5" fill={L.accent} />
      <rect x="149" y="160" width="7" height="78" rx="3.5" fill={L.accent} />
      <rect x="64" y="218" width="92" height="11" fill={L.accent} />
      <rect x="104" y="219" width="12" height="9" rx="2" fill={L.accent2} />
      {/* chest: team badge + car number */}
      <circle cx="88" cy="184" r="15" fill={badge} />
      {logo && <image href={logo} x="76" y="172" width="24" height="24" preserveAspectRatio="xMidYMid meet" />}
      {number !== undefined && (
        <text x="134" y="194" textAnchor="middle" fontFamily="Titillium Web, sans-serif" fontWeight="900" fontStyle="italic" fontSize="28" fill={L.text}>
          {number}
        </text>
      )}


      {/* helmet */}
      <g>
        <circle cx="110" cy="96" r="70" fill={L.helmet} />
        <g clipPath={`url(#hc${uid})`}>
          <path d="M40 70 Q110 20 180 70 L180 82 Q110 36 40 82 Z" fill={L.helmetStripe} />
          <path d="M40 140 Q110 168 180 140 L180 170 L40 170 Z" fill={L.helmetStripe} opacity=".9" />
        </g>
        {/* face opening */}
        <rect x="58" y="80" width="104" height="58" rx="26" fill="#1b1b1f" />
        <rect x="63" y="85" width="94" height="49" rx="22" fill="#f6d3b5" />
        <ellipse cx="94" cy="111" rx="7" ry="10" fill="#111" />
        <ellipse cx="126" cy="111" rx="7" ry="10" fill="#111" />
        <circle cx="96" cy="107" r="2.4" fill="#fff" />
        <circle cx="128" cy="107" r="2.4" fill="#fff" />
        <path d="M104 124 Q110 129 116 124" stroke="#9a5a40" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* raised visor */}
        <path d="M54 82 Q110 50 166 82 L162 92 Q110 64 58 92 Z" fill={`url(#vg${uid})`} />
        {/* logo on the helmet side */}
        <circle cx="70" cy="58" r="17" fill={badge} stroke={L.helmetStripe} strokeWidth="2.5" />
        {logo && <image href={logo} x="57" y="45" width="26" height="26" preserveAspectRatio="xMidYMid meet" />}
        {/* gloss */}
        <circle cx="110" cy="96" r="70" fill={`url(#hg${uid})`} />
      </g>

      {celebrate && [armUp(-1), armUp(1)]}

      {/* trophy held up in the right hand */}
      {celebrate && trophy && (
        <g transform="translate(190 8) scale(.95)">
          <path d="M-16 0 h32 v12 c0 12 -7 19 -16 19 s-16 -7 -16 -19 z" fill={trophy} />
          <path d="M-16 4 h-8 v4 c0 6 4 10 9 10 M16 4 h8 v4 c0 6 -4 10 -9 10" stroke={trophy} strokeWidth="3.5" fill="none" />
          <rect x="-4" y="30" width="8" height="8" fill={trophy} />
          <rect x="-12" y="37" width="24" height="7" rx="2" fill={trophy} />
        </g>
      )}
    </svg>
  );
}
