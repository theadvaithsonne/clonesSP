"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal language-keyword highlighter for the most common languages used
// in chat. Real syntax highlighting libs (prism/highlight.js) add 100KB+,
// which is overkill for short snippets — this gives readable color cues
// without shipping another dependency.

type Token = { text: string; cls?: string };

const PATTERNS: Record<string, Array<{ re: RegExp; cls: string }>> = {
  js: [
    { re: /\/\/[^\n]*/g, cls: "tk-comment" },
    { re: /\/\*[\s\S]*?\*\//g, cls: "tk-comment" },
    { re: /(["'`])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\b\d+(\.\d+)?\b/g, cls: "tk-number" },
    {
      re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|super|import|export|from|default|async|await|try|catch|finally|throw|true|false|null|undefined|typeof|instanceof|in|of|yield|delete|void)\b/g,
      cls: "tk-keyword",
    },
    { re: /\b([A-Z][A-Za-z0-9_]*)\b/g, cls: "tk-class" },
    { re: /\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, cls: "tk-func" },
  ],
  ts: [
    { re: /\/\/[^\n]*/g, cls: "tk-comment" },
    { re: /\/\*[\s\S]*?\*\//g, cls: "tk-comment" },
    { re: /(["'`])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\b\d+(\.\d+)?\b/g, cls: "tk-number" },
    {
      re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|super|import|export|from|default|async|await|try|catch|finally|throw|true|false|null|undefined|typeof|instanceof|in|of|yield|delete|void|interface|type|enum|public|private|protected|readonly|as|implements|namespace|abstract|keyof|satisfies)\b/g,
      cls: "tk-keyword",
    },
    { re: /\b([A-Z][A-Za-z0-9_]*)\b/g, cls: "tk-class" },
    { re: /\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, cls: "tk-func" },
  ],
  python: [
    { re: /#[^\n]*/g, cls: "tk-comment" },
    { re: /(["'])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\b\d+(\.\d+)?\b/g, cls: "tk-number" },
    {
      re: /\b(def|return|if|elif|else|for|while|class|import|from|as|try|except|finally|raise|with|lambda|True|False|None|and|or|not|in|is|pass|break|continue|global|nonlocal|yield|async|await)\b/g,
      cls: "tk-keyword",
    },
    { re: /\b([A-Z][A-Za-z0-9_]*)\b/g, cls: "tk-class" },
    { re: /\b([a-zA-Z_][\w]*)(?=\s*\()/g, cls: "tk-func" },
  ],
  sql: [
    { re: /--[^\n]*/g, cls: "tk-comment" },
    { re: /(["'])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\b\d+(\.\d+)?\b/g, cls: "tk-number" },
    {
      re: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|NULL|IS|IN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|CREATE|TABLE|DROP|ALTER|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|CASE|WHEN|THEN|ELSE|END|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|TRUE|FALSE)\b/gi,
      cls: "tk-keyword",
    },
  ],
  json: [
    { re: /(["])(?:\\.|(?!\1).)*\1(?=\s*:)/g, cls: "tk-property" },
    { re: /(["])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\b\d+(\.\d+)?\b/g, cls: "tk-number" },
    { re: /\b(true|false|null)\b/g, cls: "tk-keyword" },
  ],
  bash: [
    { re: /#[^\n]*/g, cls: "tk-comment" },
    { re: /(["'])(?:\\.|(?!\1).)*\1/g, cls: "tk-string" },
    { re: /\$\{?[A-Za-z_][\w]*\}?/g, cls: "tk-variable" },
    {
      re: /\b(if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|return|exit|export|local|readonly|echo|cd|ls|cat|grep|sed|awk|cp|mv|rm|mkdir|touch|chmod|chown|sudo)\b/g,
      cls: "tk-keyword",
    },
  ],
};

const ALIASES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  jsx: "js",
  tsx: "ts",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
};

function tokenize(code: string, lang?: string): Token[] {
  const key = lang ? ALIASES[lang.toLowerCase()] || lang.toLowerCase() : "";
  const rules = PATTERNS[key];
  if (!rules) return [{ text: code }];

  type Match = { start: number; end: number; cls: string };
  const matches: Match[] = [];
  for (const { re, cls } of rules) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      matches.push({ start: m.index, end: m.index + m[0].length, cls });
    }
  }
  // Sort by start, then by length desc (prefer longer matches)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // already covered
    if (m.start > cursor) tokens.push({ text: code.slice(cursor, m.start) });
    tokens.push({ text: code.slice(m.start, m.end), cls: m.cls });
    cursor = m.end;
  }
  if (cursor < code.length) tokens.push({ text: code.slice(cursor) });
  return tokens;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
  className?: string;
}

export function CodeBlock({ code, lang, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const tokens = tokenize(code, lang);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={cn("relative my-1.5 rounded-md border border-[#2E2E2E] bg-[#0b0b0f] overflow-hidden", className)}>
      <div className="flex items-center justify-between px-2 py-1 bg-[#15151b] border-b border-[#2E2E2E]">
        <span className="text-[9px] uppercase tracking-wide text-[#9fa0b8]">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-[9px] text-[#9fa0b8] hover:text-white transition-colors"
        >
          {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="garage-code-block overflow-x-auto p-2 text-[10px] leading-relaxed font-mono text-[#e1e1e6]">
        <code>
          {tokens.map((t, i) =>
            t.cls ? (
              <span key={i} className={t.cls}>
                {t.text}
              </span>
            ) : (
              <React.Fragment key={i}>{t.text}</React.Fragment>
            )
          )}
        </code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1 py-0.5 rounded bg-black/30 border border-white/10 font-mono text-[0.9em] text-brand">
      {children}
    </code>
  );
}
