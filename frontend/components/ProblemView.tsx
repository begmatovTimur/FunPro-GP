import { Fragment, type ReactNode } from "react";
import { COLOR_LABEL, lapTime, pts } from "@/lib/format";
import type { Problem } from "@/lib/types";

/** Tiny markdown: paragraphs, "- " lists, `code`, **bold**. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => <li key={j}>{inline(l.trim().slice(2))}</li>)}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default function ProblemView({ p }: { p: Problem }) {
  const prog = p.progress;
  const diff = p.difficulty.toLowerCase();
  return (
    <div className="problem-body">
      <h1>{p.order}. {p.title}</h1>
      <div className="badges">
        <span className={`badge ${diff}`}>{p.difficulty}</span>
        <span className="badge">{p.max_points} pts</span>
        <span className="badge">{p.tests_count} hidden tests</span>
        <span className="badge">Time limit {p.time_limit}s</span>
        {prog.attempts > 0 && !prog.solved && (
          <span className="badge" style={{ color: "#fff" }}>Best: {prog.best_passed}/{prog.total_tests} · {pts(prog.points)} pts</span>
        )}
      </div>

      {prog.solved && prog.color && (
        <div className={`lap-banner t-${prog.color}`}>
          <span>✓ Solved · {pts(prog.points)} pts</span>
          <span style={{ opacity: 0.85, fontWeight: 600 }}>{COLOR_LABEL[prog.color]}</span>
          <span className="t">{lapTime(prog.lap_seconds)}</span>
        </div>
      )}

      <Markdown text={p.statement} />

      {p.input_format && (
        <>
          <h3>Input</h3>
          <Markdown text={p.input_format} />
        </>
      )}
      {p.output_format && (
        <>
          <h3>Output</h3>
          <Markdown text={p.output_format} />
        </>
      )}

      {p.examples.map((ex, i) => (
        <Fragment key={i}>
          <h3>Example {i + 1}</h3>
          <div className="example">
            <div className="lbl">Input:</div>
            <pre>{ex.input.replace(/\n$/, "")}</pre>
            <div className="lbl">Output:</div>
            <pre>{ex.output.replace(/\n$/, "")}</pre>
            {ex.explanation && (
              <>
                <div className="lbl">Explanation:</div>
                <div style={{ fontSize: 14.5, color: "#cfcfd6" }}>{inline(ex.explanation)}</div>
              </>
            )}
          </div>
        </Fragment>
      ))}

      {p.constraints.length > 0 && (
        <>
          <h3>Constraints</h3>
          <ul>
            {p.constraints.map((c, i) => <li key={i}><code>{c}</code></li>)}
          </ul>
        </>
      )}
      {p.notes && (
        <>
          <h3>Race engineer says</h3>
          <Markdown text={p.notes} />
        </>
      )}
    </div>
  );
}
