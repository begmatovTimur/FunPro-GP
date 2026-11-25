"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import TeamSelect from "@/components/TeamSelect";
import { api, getToken, setToken } from "@/lib/api";
import { TEAMS } from "@/lib/teams";

type Registration = { name: string; suggested: string; taken: string[] };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Second step, only for a new driver:
  const [reg, setReg] = useState<Registration | null>(null);
  const [code, setCode] = useState("");
  const [team, setTeam] = useState<string | null>(null);

  // Already logged in? Go straight on.
  useEffect(() => {
    if (!getToken()) return;
    api.me().then(
      (m) => router.replace(m.role === "admin" ? "/admin" : "/"),
      () => setToken(null),
    );
  }, [router]);

  // Code ideas from the name: KIM, ANT for "Kimi Antonelli".
  const ideas = useMemo(() => {
    if (!reg) return [];
    const words = reg.name.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "").toUpperCase()).filter((w) => w.length >= 3);
    const list = [reg.suggested, ...words.map((w) => w.slice(0, 3)), ...words.slice(0, 2).map((w, i, a) => (a.length > 1 && i === 0 ? (w[0] + a[1].slice(0, 2)) : ""))];
    return [...new Set(list.filter((c) => /^[A-Z]{3}$/.test(c)))];
  }, [reg]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) return setErr("Enter your name and a password.");
    if (reg) {
      if (!/^[A-Z]{3}$/.test(code)) return setErr("Your driver code must be exactly 3 letters.");
      if (reg.taken.includes(code)) return setErr(`${code} is already taken. Pick another code.`);
      if (!team) return setErr("Pick your team.");
    }
    setBusy(true);
    try {
      const r = await api.login(username.trim(), password, reg ? { code, team: team! } : undefined);
      if (r.needs_registration) {
        setReg({ name: r.name, suggested: r.suggested_code, taken: r.taken_codes });
        setCode(r.taken_codes.includes(r.suggested_code) ? "" : r.suggested_code);
        setBusy(false);
        return;
      }
      setToken(r.token);
      router.replace(r.role === "admin" ? "/admin" : "/");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const teamInfo = TEAMS.find((t) => t.id === team);

  return (
    <div className="login-page">
      <div className="login-stripes" />
      <div className="login-grid">
        <section className="login-hero">
          <div className="brand" style={{ fontSize: 30 }}>
            <span className="brand-mark" style={{ width: 62, height: 30 }} />
            <span>FunPro <b>GP</b></span>
          </div>
          <div className="eyebrow" style={{ color: "var(--red)", marginTop: 48 }}>University Grand Prix · Coding qualifying</div>
          <h1 className="h-display login-title">
            Lights out<br />and <span className="accent">code</span>
          </h1>
          <div className="login-lights" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.35}s` }} />)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Q1", "Easy", "25 min"], ["Q2", "Medium", "27 min"], ["Q3", "Hard", "32 min"]].map(([q, l, t]) => (
              <div key={q} className="login-q">
                <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 22 }}>{q}</div>
                <div className="muted" style={{ fontSize: 13 }}>{l} · {t}</div>
              </div>
            ))}
          </div>
        </section>

        <form className="login-card" onSubmit={submit}>
          <div className="login-card-stripe" />
          {!reg ? (
            <>
              <div className="eyebrow">Super licence check</div>
              <h2 className="login-h2">Driver login</h2>
              <div className="field" style={{ marginBottom: 16 }}>
                <label htmlFor="u">Full name</label>
                <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus maxLength={32} placeholder="e.g. Kimi Antonelli" />
              </div>
              <div className="field" style={{ marginBottom: 18 }}>
                <label htmlFor="p">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="p"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    maxLength={64}
                    style={{ paddingRight: 64 }}
                  />
                  <button type="button" className="login-show" onClick={() => setShow((x) => !x)}>
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {err && <div className="error-box" style={{ marginBottom: 14 }}>{err}</div>}
              <button className="btn btn-red btn-lg" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Checking…" : "Enter the paddock"}
              </button>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "18px 0 0" }}>
                First time here? Type your name and choose a password. Next you&apos;ll pick your driver code and team.
                Remember the password: you&apos;ll need it if you log in again.
              </p>
            </>
          ) : (
            <>
              <div className="eyebrow" style={{ color: "var(--red)" }}>New driver · step 2 of 2</div>
              <h2 className="login-h2">Build your licence</h2>

              <div className="licence-preview" style={{ borderLeftColor: teamInfo?.color ?? "var(--panel-3)" }}>
                <TeamLogo team={team} color="#333" size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reg.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{teamInfo?.name ?? "No team yet"}</div>
                </div>
                <div className="licence-code" style={{ color: teamInfo?.color ?? "#fff" }}>{code || "???"}</div>
              </div>

              <div className="field" style={{ marginBottom: 8 }}>
                <label htmlFor="c">Driver code (3 letters)</label>
                <input
                  id="c"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                  maxLength={3}
                  autoFocus
                  placeholder="ANT"
                  style={{ textTransform: "uppercase", fontWeight: 900, letterSpacing: 4, fontSize: 20 }}
                />
              </div>
              <div className="case-chips" style={{ marginBottom: 16 }}>
                {ideas.map((c) => {
                  const taken = reg.taken.includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      className={`chip ${code === c ? "on" : ""}`}
                      disabled={taken}
                      title={taken ? "Already taken" : `Use ${c}`}
                      onClick={() => setCode(c)}
                      style={taken ? { textDecoration: "line-through", opacity: 0.4 } : { letterSpacing: 1.5, fontWeight: 900 }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Team</label>
                <TeamSelect value={team} onChange={setTeam} />
              </div>

              {err && <div className="error-box" style={{ marginBottom: 14 }}>{err}</div>}
              <button className="btn btn-red btn-lg" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Registering…" : "Create driver & enter"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => { setReg(null); setErr(""); setCode(""); setTeam(null); }}
              >
                ← Not you? Change name
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
