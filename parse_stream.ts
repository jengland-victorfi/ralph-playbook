#!/usr/bin/env bun
/**
 * Pretty-print cursor-agent --output-format stream-json (newline-delimited JSON).
 * Usage: cursor-agent ... --output-format stream-json | bun run parse_stream.ts
 */
import * as readline from "readline";

const ansi = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
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
            `${ansi.bold}${ansi.cyan}${"#".repeat(level)} ${children}${ansi.reset}\n`,
          paragraph: (children) => `${children}\n`,
          blockquote: (children) =>
            children
              .split("\n")
              .map((line) => `${ansi.dim}|${ansi.reset} ${line}`)
              .join("\n") + "\n",
          code: (children, meta) => {
            const lang = meta?.language ? `${ansi.dim}${meta.language}${ansi.reset}\n` : "";
            return `${lang}${ansi.gray}${children}${ansi.reset}\n`;
          },
          codespan: (children) => `${ansi.yellow}${children}${ansi.reset}`,
          strong: (children) => `${ansi.bold}${children}${ansi.reset}`,
          emphasis: (children) => `${ansi.italic}${children}${ansi.reset}`,
          strikethrough: (children) => `${ansi.dim}~${children}~${ansi.reset}`,
          link: (children, { href }) =>
            `${ansi.blue}${ansi.underline}${children}${ansi.reset} ${ansi.dim}(${href})${ansi.reset}`,
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
          hr: () => `${ansi.dim}────────────────${ansi.reset}\n`,
          table: (children) => `\n${children}`,
          thead: (children) => children,
          tbody: (children) => children,
          tr: (children) => `${children}\n`,
          th: (children, { align }) => {
            const a = align ? `:${align}` : "";
            return `${ansi.bold}${children}${ansi.reset}${a}\t`;
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
  if (!tc) return `\n${ansi.yellow}[TOOL]${ansi.reset} (unknown)`;

  if (tc.shellToolCall) {
    const c = tc.shellToolCall as { args?: { command?: string } };
    return `\n${ansi.yellow}[SHELL]${ansi.reset} ${c.args?.command ?? ""}`;
  }
  if (tc.readToolCall) {
    const c = tc.readToolCall as { args?: { path?: string; offset?: number; limit?: number } };
    const extra =
      c.args?.offset != null
        ? ` (offset: ${c.args.offset}, limit: ${c.args.limit ?? ""})`
        : "";
    return `\n${ansi.yellow}[READ]${ansi.reset} ${c.args?.path ?? ""}${extra}`;
  }
  if (tc.editToolCall) {
    const c = tc.editToolCall as { args?: { path?: string } };
    return `\n${ansi.yellow}[EDIT]${ansi.reset} ${c.args?.path ?? ""}`;
  }
  if (tc.grepToolCall) {
    const c = tc.grepToolCall as { args?: { pattern?: string; path?: string } };
    return `\n${ansi.yellow}[GREP]${ansi.reset} ${c.args?.pattern ?? ""} in ${c.args?.path ?? ""}`;
  }
  if (tc.lsToolCall) {
    const c = tc.lsToolCall as { args?: { path?: string; ignore?: string[] } };
    const ign =
      c.args?.ignore?.length ? ` (ignore: ${c.args.ignore.join(", ")})` : "";
    return `\n${ansi.yellow}[LS]${ansi.reset} ${c.args?.path ?? ""}${ign}`;
  }
  if (tc.globToolCall) {
    const c = tc.globToolCall as { args?: { globPattern?: string; targetDirectory?: string } };
    return `\n${ansi.yellow}[GLOB]${ansi.reset} ${c.args?.globPattern ?? ""} in ${c.args?.targetDirectory ?? ""}`;
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
    return `\n${ansi.yellow}[TODO]${ansi.reset} ${m} ${n} todos${body}`;
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
    return `\n${ansi.yellow}[UPDATE_TODOS]${ansi.reset} ${m} ${n} todos${body}`;
  }
  if (tc.writeToolCall) {
    const c = tc.writeToolCall as { args?: { path?: string; fileText?: string } };
    const len = c.args?.fileText?.length ?? 0;
    const preview = truncate(c.args?.fileText ?? "", 100);
    return `\n${ansi.yellow}[WRITE]${ansi.reset} ${c.args?.path ?? ""} (${len} chars)\n  ${preview}`;
  }
  if (tc.deleteToolCall) {
    const c = tc.deleteToolCall as { args?: { path?: string } };
    return `\n${ansi.yellow}[DELETE]${ansi.reset} ${c.args?.path ?? ""}`;
  }

  const keys = Object.keys(tc);
  const first = keys[0];
  if (!first) return `\n${ansi.yellow}[TOOL]${ansi.reset}`;
  const inner = tc[first] as { args?: Record<string, unknown> } | undefined;
  const argStr = inner?.args ? formatArgs(inner.args) : "";
  return `\n${ansi.yellow}[TOOL]${ansi.reset} ${first}${argStr}`;
}

function formatToolCompleted(obj: Record<string, unknown>): string {
  const tc = obj.tool_call as Record<string, unknown> | undefined;
  if (!tc) return `\n${ansi.gray}✓ Completed${ansi.reset}`;

  if (tc.shellToolCall) {
    const c = tc.shellToolCall as { result?: { success?: { exitCode?: number } } };
    if (c.result?.success)
      return `\n${ansi.gray}✓ Exit ${c.result.success.exitCode ?? "?"}${ansi.reset}`;
    return `\n${ansi.red}✗ Failed${ansi.reset}`;
  }
  if (tc.readToolCall) {
    const c = tc.readToolCall as { result?: { success?: { totalLines?: number } } };
    if (c.result?.success)
      return `\n${ansi.gray}✓ Read ${c.result.success.totalLines ?? "?"} lines${ansi.reset}`;
    return `\n${ansi.red}✗ Read failed${ansi.reset}`;
  }
  if (tc.editToolCall) {
    const c = tc.editToolCall as { result?: { success?: unknown } };
    if (c.result?.success) return `\n${ansi.gray}✓ Edited${ansi.reset}`;
    return `\n${ansi.red}✗ Edit failed${ansi.reset}`;
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
      return `\n${ansi.gray}✓ Found ${n} matches${ansi.reset}`;
    }
    return `\n${ansi.red}✗ Grep failed${ansi.reset}`;
  }
  if (tc.lsToolCall) {
    const c = tc.lsToolCall as {
      result?: { success?: { directoryTreeRoot?: { childrenFiles?: unknown[]; childrenDirs?: unknown[] } } };
    };
    if (c.result?.success) {
      const root = c.result.success.directoryTreeRoot;
      const f = root?.childrenFiles?.length ?? 0;
      const d = root?.childrenDirs?.length ?? 0;
      return `\n${ansi.gray}✓ Listed ${f} files, ${d} dirs${ansi.reset}`;
    }
    return `\n${ansi.red}✗ List failed${ansi.reset}`;
  }
  if (tc.globToolCall) {
    const c = tc.globToolCall as { result?: { success?: { totalFiles?: number } } };
    if (c.result?.success)
      return `\n${ansi.gray}✓ Found ${c.result.success.totalFiles ?? "?"} files${ansi.reset}`;
    return `\n${ansi.red}✗ Glob failed${ansi.reset}`;
  }
  if (tc.todoToolCall) {
    const c = tc.todoToolCall as {
      result?: { success?: { todos?: { status?: string; content?: string }[] } };
    };
    if (c.result?.success) {
      let body = "";
      if (c.result.success.todos?.length)
        body = `\n  ${c.result.success.todos.map(formatTodoLine).join("\n  ")}`;
      return `\n${ansi.gray}✓ Updated todos${ansi.reset}${body}`;
    }
    return `\n${ansi.red}✗ Todo update failed${ansi.reset}`;
  }
  if (tc.updateTodosToolCall) {
    const c = tc.updateTodosToolCall as {
      result?: { success?: { todos?: { status?: string; content?: string }[] } };
    };
    if (c.result?.success) {
      let body = "";
      if (c.result.success.todos?.length)
        body = `\n  ${c.result.success.todos.map(formatTodoLine).join("\n  ")}`;
      return `\n${ansi.gray}✓ Updated todos${ansi.reset}${body}`;
    }
    return `\n${ansi.red}✗ Todo update failed${ansi.reset}`;
  }
  if (tc.writeToolCall) {
    const c = tc.writeToolCall as {
      result?: { success?: { linesCreated?: number; fileSize?: number } };
      args?: { path?: string };
    };
    if (c.result?.success) {
      const p = c.args?.path ?? "";
      return `\n${ansi.gray}✓ Wrote ${c.result.success.linesCreated ?? "?"} lines (${c.result.success.fileSize ?? "?"} bytes) to ${p}${ansi.reset}`;
    }
    return `\n${ansi.red}✗ Write failed${ansi.reset}`;
  }
  if (tc.deleteToolCall) {
    const c = tc.deleteToolCall as {
      result?: { success?: unknown; rejected?: { reason?: string } };
      args?: { path?: string };
    };
    if (c.result?.success)
      return `\n${ansi.gray}✓ Deleted ${c.args?.path ?? ""}${ansi.reset}`;
    if (c.result?.rejected)
      return `\n${ansi.red}✗ Delete rejected: ${c.result.rejected.reason ?? "unknown"}${ansi.reset}`;
    return `\n${ansi.red}✗ Delete failed${ansi.reset}`;
  }

  return `\n${ansi.gray}✓ Completed${ansi.reset}`;
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
      process.stdout.write(`\n${ansi.cyan}[USER]${ansi.reset}\n${markdownToAnsi(text)}`);
    return;
  }

  if (type === "assistant") {
    const text = extractMessageText(obj.message as { content?: ContentBlock[] });
    if (text)
      process.stdout.write(`\n${ansi.green}[ASSISTANT]${ansi.reset}\n${markdownToAnsi(text)}`);
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
      `\n${ansi.magenta}[RESULT]${ansi.reset} ${subtype} (${ms != null ? `${ms}ms` : "?"})`,
    );
    return;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", processLine);
