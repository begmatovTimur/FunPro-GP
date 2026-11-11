"use client";

import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

const panelTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#1f1f29" },
    ".cm-gutters": { backgroundColor: "#1f1f29", borderRight: "none", color: "#5c5c68" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#c9c9d1" },
  },
  { dark: true },
);

export default function CodeEditor({
  value,
  onChange,
  onRun,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  readOnly?: boolean;
}) {
  const extensions = useMemo(
    () => [
      python(),
      indentUnit.of("    "),
      panelTheme,
      Prec.highest(keymap.of([{ key: "Mod-'", run: () => { onRun(); return true; } }])),
    ],
    [onRun],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={oneDark}
      extensions={extensions}
      readOnly={readOnly}
      height="100%"
      style={{ height: "100%" }}
      basicSetup={{ tabSize: 4, foldGutter: false }}
    />
  );
}
