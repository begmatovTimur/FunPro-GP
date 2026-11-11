"use client";

import { useState } from "react";
import { pts, VERDICT_LABEL } from "@/lib/format";
import type { Problem, RunResponse, SubmitResponse } from "@/lib/types";

export type ConsoleResult =
  | { kind: "run"; data: RunResponse; custom: boolean }
  | { kind: "submit"; data: SubmitResponse }
  | { kind: "error"; message: string }
  | null;

export default function ConsolePanel({
  problem,
  tab,
  setTab,
  caseIdx,
  setCaseIdx,
  customInput,
  setCustomInput,
  result,
  busy,
}: {
  problem: Problem;
  tab: "cases" | "result";
  setTab: (t: "cases" | "result") => void;
  caseIdx: number; // -1 = custom
  setCaseIdx: (i: number) => void;
  customInput: string;
  setCustomInput: (s: string) => void;
  result: ConsoleResult;
  busy: "run" | "submit" | null;
}) {
  return (
    <div className="pane console" style={{ flex: 1 }}>
      <div className="pane-head">
        <button className={`tab ${tab === "cases" ? "on" : ""}`} onClick={() => setTab("cases")}>
          <span style={{ color: "var(--green)" }}>☑</span> Testcase
        </button>
        <button className={`tab ${tab === "result" ? "on" : ""}`} onClick={() => setTab("result")}>
          <span style={{ color: "var(--green)" }}>›_</span> Test Result
        </button>
      </div>
      <div className="console-body">
        {tab === "cases" ? (
          <>
            <div className="case-chips">
              {problem.examples.map((_, i) => (
                <button key={i} className={`chip ${caseIdx === i ? "on" : ""}`} onClick={() => setCaseIdx(i)}>
                  Case {i + 1}
                </button>
              ))}
              <button className={`chip ${caseIdx === -1 ? "on" : ""}`} onClick={() => setCaseIdx(-1)}>
                + Custom input
              </button>
            </div>
            {caseIdx === -1 ? (
              <>
                <div className="io-label">Your input (Run will use only this)</div>
                <textarea
                  className="io"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder={problem.examples[0]?.input ?? ""}
                  spellCheck={false}
                />
              </>
            ) : (
              problem.examples[caseIdx] && (
                <>
                  <div className="io-label">Input</div>
                  <pre className="io">{problem.examples[caseIdx].input.replace(/\n$/, "")}</pre>
                  <div className="io-label">Expected output</div>
                  <pre className="io">{problem.examples[caseIdx].output.replace(/\n$/, "")}</pre>
                </>
              )
            )}
          </>
        ) : (
          <ResultView result={result} busy={busy} />
        )}
      </div>
    </div>
  );
}

function ResultView({ result, busy }: { result: ConsoleResult; busy: "run" | "submit" | null }) {
  const [sel, setSel] = useState(0);
  if (busy)
    return (
      <div className="empty-console">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="spinner" /> {busy === "run" ? "Running your code…" : "Judging on 10 hidden tests…"}
        </div>
      </div>
    );
  if (!result) return <div className="empty-console">Run your code to see results here.<br />Shortcut: Ctrl + &apos;</div>;
  if (result.kind === "error") return <div className="error-box">{result.message}</div>;

  if (result.kind === "run") {
    const cases = result.data.cases;
    const allOk = cases.every((c) => c.verdict === "passed" || c.verdict === "ran");
    const c = cases[Math.min(sel, cases.length - 1)];
    const headline = result.custom
      ? VERDICT_LABEL[c.verdict]
      : allOk
        ? "All examples passed"
        : VERDICT_LABEL[cases.find((x) => x.verdict !== "passed")!.verdict];
    return (
      <>
        <div className={`verdict-big ${allOk ? "ok" : "bad"}`}>
          {headline}
          {c.time !== null && <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Runtime: {Math.round(c.time * 1000)} ms</span>}
        </div>
        {!result.custom && (
          <div className="case-chips" style={{ marginTop: 12 }}>
            {cases.map((x, i) => (
              <button key={i} className={`chip ${i === sel ? "on" : ""}`} onClick={() => setSel(i)}>
                <span className="dot" style={{ background: x.verdict === "passed" ? "var(--green)" : "var(--fail)" }} />
                Case {i + 1}
              </button>
            ))}
          </div>
        )}
        {c.stderr && (
          <>
            <div className="io-label">Error</div>
            <pre className="io err">{c.stderr}</pre>
          </>
        )}
        <div className="io-label">Input</div>
        <pre className="io">{c.input.replace(/\n$/, "") || " "}</pre>
        <div className="io-label">Your output</div>
        <pre className="io">{c.output.replace(/\n$/, "") || " "}</pre>
        {c.expected !== null && (
          <>
            <div className="io-label">Expected</div>
            <pre className="io">{c.expected.replace(/\n$/, "")}</pre>
          </>
        )}
      </>
    );
  }

  const d = result.data;
  const ok = d.verdict === "accepted";
  return (
    <>
      <div className={`verdict-big ${ok ? "ok" : "bad"}`}>
        {VERDICT_LABEL[d.verdict]}
        <span style={{ fontSize: 15, color: "#fff" }}>
          {d.passed}/{d.total} tests passed · +{pts(d.points_this_run)} pts
        </span>
      </div>
      <div className="test-grid">
        {d.tests.map((t) => (
          <div key={t.n} className={`test-cell ${t.verdict === "passed" ? "ok" : ""}`} title={VERDICT_LABEL[t.verdict]}>
            {t.verdict === "passed" ? "✓" : t.verdict === "time_limit" ? "TLE" : t.verdict === "wrong_answer" ? "WA" : "✕"}
          </div>
        ))}
      </div>
      {!ok && (
        <p className="muted" style={{ margin: "0 0 8px" }}>
          {d.improved
            ? "New best for this problem: your points were updated."
            : `Your best on this problem is still ${d.progress.best_passed}/${d.progress.total_tests} (${pts(d.progress.points)} pts).`}{" "}
          Hidden test inputs are secret. Check edge cases and speed.
        </p>
      )}
      {d.error && (
        <>
          <div className="io-label">Error</div>
          <pre className="io err">{d.error}</pre>
        </>
      )}
    </>
  );
}
