/**
 * 文件系统工具集：list_files / read_file / grep
 *
 * 设计要点：
 * 1) 所有路径都被沙盒限制在「启动 cwd」之内，禁止 ../ 越界。
 *    虽然这是学习用 demo，但「给 LLM 的工具一定要做权限边界」是 agent 工程的基本素养。
 * 2) read_file 有大小上限，防止 LLM 误读大文件把 context 撑爆。
 * 3) grep 用 JS 正则，行号从 1 开始，方便 LLM 直接给用户列出来。
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, relative, join, dirname } from "node:path";

export const SANDBOX_ROOT = process.cwd();

function safePath(p: string): string {
  const abs = resolve(SANDBOX_ROOT, p);
  const rel = relative(SANDBOX_ROOT, abs);
  if (rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error(`路径越界禁止访问: ${p}`);
  }
  return abs;
}

export function listFiles({ dir }: { dir: string }) {
  const abs = safePath(dir);
  return readdirSync(abs).map((name) => {
    const st = statSync(join(abs, name));
    return {
      name,
      type: st.isDirectory() ? "dir" : "file",
      ...(st.isFile() ? { size: st.size } : {}),
    };
  });
}

export function readFile({ path }: { path: string }): string {
  const abs = safePath(path);
  const content = readFileSync(abs, "utf-8");
  return content.length > 50_000
    ? content.slice(0, 50_000) + "\n...[truncated, file too large]"
    : content;
}

export function grep({ pattern, path }: { pattern: string; path: string }) {
  const content = readFile({ path });
  const re = new RegExp(pattern);
  const matches: Array<{ line: number; text: string }> = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]!)) {
      matches.push({ line: i + 1, text: lines[i]!.slice(0, 200) });
    }
  }
  return matches;
}

// === 暴露给 LLM 的 schemas ===
export const filesystemSchemas = [
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "列出指定目录下的所有文件和子目录。仅限当前工作目录内。",
      parameters: {
        type: "object",
        properties: {
          dir: { type: "string", description: "目录相对路径，如 '.' 'src' 'src/tools'" },
        },
        required: ["dir"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "读取指定文件的完整内容（最多 50KB，超出会截断）。",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "文件相对路径" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "grep",
      description: "在单个文件里搜索匹配 JavaScript 正则的所有行，返回行号和内容。",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JS 正则，如 'TODO' 或 'console\\\\.log'" },
          path: { type: "string", description: "文件相对路径" },
        },
        required: ["pattern", "path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "将内容写入指定文件（会自动创建中间目录）。如果文件已存在会覆盖。仅限沙盒内。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件相对路径" },
          content: { type: "string", description: "要写入的完整文件内容" },
        },
        required: ["path", "content"],
      },
    },
  },
];

export function writeFile({ path: p, content }: { path: string; content: string }): string {
  const abs = safePath(p);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(abs, content, "utf-8");
  return `已写入 ${content.length} 字符到 ${p}`;
}

export function runFilesystemTool(name: string, args: unknown): unknown {
  switch (name) {
    case "list_files": return listFiles(args as { dir: string });
    case "read_file": return readFile(args as { path: string });
    case "grep": return grep(args as { pattern: string; path: string });
    case "write_file": return writeFile(args as { path: string; content: string });
    default: throw new Error(`未知工具: ${name}`);
  }
}
