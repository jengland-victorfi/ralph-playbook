#!/usr/bin/env bun
/**
 * Pretty-print cursor-agent --output-format stream-json (newline-delimited JSON).
 * Usage: cursor-agent ... --output-format stream-json | bun run parse_stream.ts
 */
import * as readline from "readline";

/** Simpsons-ish 256-color terminal palette */
const sim = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  /** Springfield sky — user prompt */
  sky: "\x1b[38;5;81m",
  /** Classic Simpson yellow — Ralph label */
  yellow: "\x1b[1;38;5;220m",
  /** Same yellow, no bold — italics in Ralph's reply */
  yellowSoft: "\x1b[38;5;220m",
  /** Bart's shirt — tool calls */
  orange: "\x1b[38;5;208m",
  /** Marge's hair — headings, links */
  marge: "\x1b[38;5;33m",
  /** Springfield grass — success */
  grass: "\x1b[38;5;82m",
  /** Pink donut frosting — session result */
  donut: "\x1b[38;5;213m",
  /** Duff can / nuclear — errors */
  duff: "\x1b[38;5;196m",
  /** Sidewalk / chalkboard — muted code */
  sidewalk: "\x1b[38;5;245m",
  /** Gold star — inline code */
  gold: "\x1b[38;5;214m",
};

const mdOpts = {
  tables: true,
  strikethrough: true,
  tasklists: true,
  autolinks: true,
} as const;

function markdownToAnsi(source: string): string {
  const text = source.trimEnd();
  if (!text) return "";
  try {
    return (
      Bun.markdown.render(
        text,
        {
          heading: (children, { level }) =>
            `${sim.bold}${sim.marge}${"#".repeat(level)} ${children}${sim.reset}\n`,
          paragraph: (children) => `${children}\n`,
          blockquote: (children) =>
            children
              .split("\n")
              .map((line) => `${sim.dim}|${sim.reset} ${line}`)
              .join("\n") + "\n",
          code: (children, meta) => {
            const lang = meta?.language ? `${sim.dim}${meta.language}${sim.reset}\n` : "";
            return `${lang}${sim.sidewalk}${children}${sim.reset}\n`;
          },
          codespan: (children) => `${sim.gold}${children}${sim.reset}`,
          strong: (children) => `${sim.bold}${sim.orange}${children}${sim.reset}`,
          emphasis: (children) => `${sim.italic}${sim.yellowSoft}${children}${sim.reset}`,
          strikethrough: (children) => `${sim.dim}~${children}~${sim.reset}`,
          link: (children, { href }) =>
            `${sim.marge}${sim.underline}${children}${sim.reset} ${sim.dim}(${href})${sim.reset}`,
          list: (children) => children,
          listItem: (children, { index, depth, ordered, start, checked }) => {
            const pad = "  ".repeat(depth);
            let marker: string;
            if (checked === true) marker = "[x]";
            else if (checked === false) marker = "[ ]";
            else if (ordered) marker = `${(start ?? 1) + index}.`;
            else marker = "-";
            return `${pad}${marker} ${children.trimEnd()}\n`;
          },
          hr: () => `${sim.dim}────────────────${sim.reset}\n`,
          table: (children) => `\n${children}`,
          thead: (children) => children,
          tbody: (children) => children,
          tr: (children) => `${children}\n`,
          th: (children, { align }) => {
            const a = align ? `:${align}` : "";
            return `${sim.bold}${sim.marge}${children}${sim.reset}${a}\t`;
          },
          td: (children) => `${children}\t`,
        },
        mdOpts,
      ).trimEnd() + "\n"
    );
  } catch {
    return `${text}\n`;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function formatArgs(args: Record<string, unknown> | null | undefined): string {
  if (args == null) return "";
  const parts = Object.entries(args).map(([key, value]) => {
    if (typeof value === "string") return `${key}: "${truncate(value, 50)}"`;
    if (Array.isArray(value)) return `${key}: [${value.length} items]`;
    if (value !== null && typeof value === "object")
      return `${key}: {${Object.keys(value as object).length} fields}`;
    return `${key}: ${String(value)}`;
  });
  return ` ${parts.join(", ")}`;
}

type ContentBlock = { type?: string; text?: string };

function extractMessageText(message: { content?: ContentBlock[] } | undefined): string {
  if (!message?.content?.length) return "";
  return message.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
}

const todoStatus: Record<string, string> = {
  TODO_STATUS_PENDING: "[ ]",
  TODO_STATUS_IN_PROGRESS: "[~]",
  TODO_STATUS_COMPLETED: "[x]",
  TODO_STATUS_CANCELLED: "[-]",
};

function formatTodoLine(t: { status?: string; content?: string }): string {
  const st = todoStatus[t.status ?? ""] ?? "[?]";
  return `${st} ${t.content ?? ""}`;
}

function formatToolStarted(obj: Record<string, unknown>): string {
  const tc = obj.tool_call as Record<string, unknown> | undefined;
  if (!tc) return `\n${sim.orange}[TOOL]${sim.reset} (unknown)`;

  if (tc.shellToolCall) {
    const c = tc.shellToolCall as { args?: { command?: string } };
    return `\n${sim.orange}[SHELL]${sim.reset} ${c.args?.command ?? ""}`;
  }
  if (tc.readToolCall) {
    const c = tc.readToolCall as { args?: { path?: string; offset?: number; limit?: number } };
    const extra =
      c.args?.offset != null
        ? ` (offset: ${c.args.offset}, limit: ${c.args.limit ?? ""})`
        : "";
    return `\n${sim.orange}[READ]${sim.reset} ${c.args?.path ?? ""}${extra}`;
  }
  if (tc.editToolCall) {
    const c = tc.editToolCall as { args?: { path?: string } };
    return `\n${sim.orange}[EDIT]${sim.reset} ${c.args?.path ?? ""}`;
  }
  if (tc.grepToolCall) {
    const c = tc.grepToolCall as { args?: { pattern?: string; path?: string } };
    return `\n${sim.orange}[GREP]${sim.reset} ${c.args?.pattern ?? ""} in ${c.args?.path ?? ""}`;
  }
  if (tc.lsToolCall) {
    const c = tc.lsToolCall as { args?: { path?: string; ignore?: string[] } };
    const ign =
      c.args?.ignore?.length ? ` (ignore: ${c.args.ignore.join(", ")})` : "";
    return `\n${sim.orange}[LS]${sim.reset} ${c.args?.path ?? ""}${ign}`;
  }
  if (tc.globToolCall) {
    const c = tc.globToolCall as { args?: { globPattern?: string; targetDirectory?: string } };
    return `\n${sim.orange}[GLOB]${sim.reset} ${c.args?.globPattern ?? ""} in ${c.args?.targetDirectory ?? ""}`;
  }
  if (tc.todoToolCall) {
    const c = tc.todoToolCall as {
      args?: { merge?: boolean; todos?: { status?: string; content?: string }[] };
    };
    const m = c.args?.merge ? "merge" : "create";
    const n = c.args?.todos?.length ?? 0;
    let body = "";
    if (c.args?.todos?.length)
      body = `\n  ${c.args.todos.map(formatTodoLine).join("\n  ")}`;
    return `\n${sim.orange}[TODO]${sim.reset} ${m} ${n} todos${body}`;
  }
  if (tc.updateTodosToolCall) {
    const c = tc.updateTodosToolCall as {
      args?: { merge?: boolean; todos?: { status?: string; content?: string }[] };
    };
    const m = c.args?.merge ? "merge" : "create";
    const n = c.args?.todos?.length ?? 0;
    let body = "";
    if (c.args?.todos?.length)
      body = `\n  ${c.args.todos.map(formatTodoLine).join("\n  ")}`;
    return `\n${sim.orange}[UPDATE_TODOS]${sim.reset} ${m} ${n} todos${body}`;
  }
  if (tc.writeToolCall) {
    const c = tc.writeToolCall as { args?: { path?: string; fileText?: string } };
    const len = c.args?.fileText?.length ?? 0;
    const preview = truncate(c.args?.fileText ?? "", 100);
    return `\n${sim.orange}[WRITE]${sim.reset} ${c.args?.path ?? ""} (${len} chars)\n  ${preview}`;
  }
  if (tc.deleteToolCall) {
    const c = tc.deleteToolCall as { args?: { path?: string } };
    return `\n${sim.orange}[DELETE]${sim.reset} ${c.args?.path ?? ""}`;
  }

  const keys = Object.keys(tc);
  const first = keys[0];
  if (!first) return `\n${sim.orange}[TOOL]${sim.reset}`;
  const inner = tc[first] as { args?: Record<string, unknown> } | undefined;
  const argStr = inner?.args ? formatArgs(inner.args) : "";
  return `\n${sim.orange}[TOOL]${sim.reset} ${first}${argStr}`;
}

function formatToolCompleted(obj: Record<string, unknown>): string {
  const tc = obj.tool_call as Record<string, unknown> | undefined;
  if (!tc) return `\n${sim.grass}✓ Completed${sim.reset}`;

  if (tc.shellToolCall) {
    const c = tc.shellToolCall as { result?: { success?: { exitCode?: number } } };
    if (c.result?.success)
      return `\n${sim.grass}✓ Exit ${c.result.success.exitCode ?? "?"}${sim.reset}`;
    return `\n${sim.duff}✗ Failed${sim.reset}`;
  }
  if (tc.readToolCall) {
    const c = tc.readToolCall as { result?: { success?: { totalLines?: number } } };
    if (c.result?.success)
      return `\n${sim.grass}✓ Read ${c.result.success.totalLines ?? "?"} lines${sim.reset}`;
    return `\n${sim.duff}✗ Read failed${sim.reset}`;
  }
  if (tc.editToolCall) {
    const c = tc.editToolCall as { result?: { success?: unknown } };
    if (c.result?.success) return `\n${sim.grass}✓ Edited${sim.reset}`;
    return `\n${sim.duff}✗ Edit failed${sim.reset}`;
  }
  if (tc.grepToolCall) {
    const c = tc.grepToolCall as {
      result?: {
        success?: { workspaceResults?: Record<string, { content?: { totalMatchedLines?: number } }> };
      };
    };
    if (c.result?.success) {
      const wr = c.result.success.workspaceResults;
      const first = wr && Object.values(wr)[0];
      const n = first?.content?.totalMatchedLines ?? "?";
      return `\n${sim.grass}✓ Found ${n} matches${sim.reset}`;
    }
    return `\n${sim.duff}✗ Grep failed${sim.reset}`;
  }
  if (tc.lsToolCall) {
    const c = tc.lsToolCall as {
      result?: { success?: { directoryTreeRoot?: { childrenFiles?: unknown[]; childrenDirs?: unknown[] } } };
    };
    if (c.result?.success) {
      const root = c.result.success.directoryTreeRoot;
      const f = root?.childrenFiles?.length ?? 0;
      const d = root?.childrenDirs?.length ?? 0;
      return `\n${sim.grass}✓ Listed ${f} files, ${d} dirs${sim.reset}`;
    }
    return `\n${sim.duff}✗ List failed${sim.reset}`;
  }
  if (tc.globToolCall) {
    const c = tc.globToolCall as { result?: { success?: { totalFiles?: number } } };
    if (c.result?.success)
      return `\n${sim.grass}✓ Found ${c.result.success.totalFiles ?? "?"} files${sim.reset}`;
    return `\n${sim.duff}✗ Glob failed${sim.reset}`;
  }
  if (tc.todoToolCall) {
    const c = tc.todoToolCall as {
      result?: { success?: { todos?: { status?: string; content?: string }[] } };
    };
    if (c.result?.success) {
      let body = "";
      if (c.result.success.todos?.length)
        body = `\n  ${c.result.success.todos.map(formatTodoLine).join("\n  ")}`;
      return `\n${sim.grass}✓ Updated todos${sim.reset}${body}`;
    }
    return `\n${sim.duff}✗ Todo update failed${sim.reset}`;
  }
  if (tc.updateTodosToolCall) {
    const c = tc.updateTodosToolCall as {
      result?: { success?: { todos?: { status?: string; content?: string }[] } };
    };
    if (c.result?.success) {
      let body = "";
      if (c.result.success.todos?.length)
        body = `\n  ${c.result.success.todos.map(formatTodoLine).join("\n  ")}`;
      return `\n${sim.grass}✓ Updated todos${sim.reset}${body}`;
    }
    return `\n${sim.duff}✗ Todo update failed${sim.reset}`;
  }
  if (tc.writeToolCall) {
    const c = tc.writeToolCall as {
      result?: { success?: { linesCreated?: number; fileSize?: number } };
      args?: { path?: string };
    };
    if (c.result?.success) {
      const p = c.args?.path ?? "";
      return `\n${sim.grass}✓ Wrote ${c.result.success.linesCreated ?? "?"} lines (${c.result.success.fileSize ?? "?"} bytes) to ${p}${sim.reset}`;
    }
    return `\n${sim.duff}✗ Write failed${sim.reset}`;
  }
  if (tc.deleteToolCall) {
    const c = tc.deleteToolCall as {
      result?: { success?: unknown; rejected?: { reason?: string } };
      args?: { path?: string };
    };
    if (c.result?.success)
      return `\n${sim.grass}✓ Deleted ${c.args?.path ?? ""}${sim.reset}`;
    if (c.result?.rejected)
      return `\n${sim.duff}✗ Delete rejected: ${c.result.rejected.reason ?? "unknown"}${sim.reset}`;
    return `\n${sim.duff}✗ Delete failed${sim.reset}`;
  }

  return `\n${sim.grass}✓ Completed${sim.reset}`;
}

function processLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    process.stderr.write(`${line}\n`);
    return;
  }

  const type = obj.type;

  if (type === "user") {
    const text = extractMessageText(obj.message as { content?: ContentBlock[] });
    if (text)
      process.stdout.write(`\n${sim.sky}[USER]${sim.reset}\n${markdownToAnsi(text)}`);
    return;
  }

  if (type === "assistant") {
    const text = extractMessageText(obj.message as { content?: ContentBlock[] });
    if (text)
      process.stdout.write(`\n${sim.yellow}[Ralph]${sim.reset}\n${markdownToAnsi(text)}`);
    return;
  }

  if (type === "tool_call" && obj.subtype === "started") {
    process.stdout.write(formatToolStarted(obj));
    return;
  }

  if (type === "tool_call" && obj.subtype === "completed") {
    process.stdout.write(formatToolCompleted(obj));
    return;
  }

  if (type === "result") {
    const subtype = String(obj.subtype ?? "");
    const ms = obj.duration_ms;
    process.stdout.write(
      `\n${sim.donut}[RESULT]${sim.reset} ${subtype} (${ms != null ? `${ms}ms` : "?"})`,
    );
    return;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", processLine);
