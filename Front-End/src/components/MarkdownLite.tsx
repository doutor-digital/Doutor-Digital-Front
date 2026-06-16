import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Renderer de markdown "lite" — cobre o que a I.A. devolve (#/##/###, listas,
// **negrito**, *itálico*, `código`). Sem dependência externa. Tema indigo do
// painel (mesmo usado em /ia-analytics e /campos-customizados).
// ─────────────────────────────────────────────────────────────────────────────

const INK = "#1E293B";
const PRIMARY = "#4F46E5";

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(
        <ul key={`list-${out.length}`} className="list-disc pl-6 my-2 space-y-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-[12.5px]">
              <InlineMd text={item} />
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      flushList();
      out.push(
        <h1 key={idx} className="font-display text-[22px] font-bold mt-3 mb-2 tracking-tight" style={{ color: INK }}>
          <InlineMd text={trimmed.slice(2)} />
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      out.push(
        <h2 key={idx} className="font-display text-[18px] font-bold mt-4 mb-1.5 tracking-tight" style={{ color: PRIMARY }}>
          <InlineMd text={trimmed.slice(3)} />
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      out.push(
        <h3 key={idx} className="font-display text-[15px] font-semibold mt-3 mb-1" style={{ color: INK }}>
          <InlineMd text={trimmed.slice(4)} />
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s/, ""));
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={idx} className="text-[12.5px] my-1.5 leading-relaxed">
          <InlineMd text={trimmed} />
        </p>,
      );
    }
  });
  flushList();
  return <>{out}</>;
}

function InlineMd({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("**") && t.endsWith("**"))
          return <strong key={i}>{t.slice(2, -2)}</strong>;
        if (t.startsWith("*") && t.endsWith("*") && t.length > 2)
          return <em key={i}>{t.slice(1, -1)}</em>;
        if (t.startsWith("`") && t.endsWith("`"))
          return (
            <code key={i} className="px-1 rounded text-[11.5px]" style={{ background: "#E5E7EB" }}>
              {t.slice(1, -1)}
            </code>
          );
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}
