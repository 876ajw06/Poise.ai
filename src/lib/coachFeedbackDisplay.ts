/** Remove one outer ``` / ```markdown-style fence if present. */
function stripOuterMarkdownCodeFence(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  let inner = t.replace(/^```[\w-]*\s*\n?/, "");
  const close = inner.lastIndexOf("```");
  if (close !== -1) inner = inner.slice(0, close) + inner.slice(close + 3);
  return inner.trim();
}

/**
 * Normalizes coach feedback for UI (and as a first pass before TTS).
 * - Turns literal "\\n" / "\\t" sequences from models into whitespace
 * - Removes a single outer markdown code fence
 * - Drops standalone horizontal-rule / ellipsis divider lines
 */
export function cleanCoachFeedbackDisplayText(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  s = s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t");

  s = stripOuterMarkdownCodeFence(s);

  s = s.replace(/^\s*(?:-{3,}|_{3,}|\*{3,}|\.{3,})\s*$/gm, "");

  // Orphan fence lines the model sometimes emits between sections
  s = s.replace(/^\s*```+\s*$/gm, "");

  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}
