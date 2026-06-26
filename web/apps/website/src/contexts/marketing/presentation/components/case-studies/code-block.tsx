/**
 * CodeBlock — server-rendered syntax-highlighted code snippet.
 *
 * Uses highlight.js server-side (inside a server component) so the client
 * never downloads the highlighter runtime — just styled HTML. A matching
 * CSS map in the layout translates hljs token classes to the CauseFlow
 * palette (github-light theme aesthetic).
 *
 * Props mirror EvidenceCard for visual consistency:
 *   - title?  — mono uppercase caption rail
 *   - tone    — default | warn | error border tint (error is the "before" side)
 *   - language — highlight.js language alias (js, ts, tsx, json, bash, ...)
 *   - code    — raw source string (newlines preserved)
 */

import hljs from 'highlight.js/lib/common';

export type CodeBlockTone = 'default' | 'warn' | 'error';

export interface CodeBlockProps {
  title?: string;
  language: string;
  code: string;
  tone?: CodeBlockTone;
}

const toneClasses: Record<CodeBlockTone, string> = {
  default: 'border-border bg-card',
  warn: 'border-amber-500/40 bg-amber-500/5',
  error: 'border-red-500/40 bg-red-500/5',
};

const titleToneClasses: Record<CodeBlockTone, string> = {
  default: 'text-muted-foreground',
  warn: 'text-amber-700',
  error: 'text-red-600',
};

export function CodeBlock({ title, language, code, tone = 'default' }: CodeBlockProps) {
  const normalized = code.replace(/^\n+|\n+$/g, '');
  const highlighted = safeHighlight(normalized, language);

  return (
    <div className={`overflow-hidden rounded-xl border ${toneClasses[tone]}`}>
      <div
        className={`flex items-center justify-between gap-3 border-b border-inherit bg-background/40 px-4 py-2 ${titleToneClasses[tone]}`}
      >
        {title ? (
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
            {title}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {language}
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12.5px] leading-[1.7]">
        <code
          className={`hljs language-${language} font-mono`}
          // highlight.js generates trusted HTML from a known string input
          // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighter output
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

/** Fall back to plain-escaped output if the requested language is unknown. */
function safeHighlight(code: string, language: string): string {
  if (hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }
  return escapeHtml(code);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
