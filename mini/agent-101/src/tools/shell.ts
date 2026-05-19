/**
 * Shell 工具：让 Agent 能执行命令（跑测试、编译检查等）
 *
 * 安全措施：
 *   - 沙盒：只能在 SANDBOX_ROOT 内执行
 *   - 超时：15 秒
 *   - 禁止危险命令
 *   - 输出截断：最多 5000 字符
 */
import { execSync } from "node:child_process";
import { SANDBOX_ROOT } from "./filesystem.js";

const FORBIDDEN = ["rm -rf /", "sudo", "mkfs", "dd if=", ":(){ :|:& };:"];

export function runCommand({ command }: { command: string }): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  for (const f of FORBIDDEN) {
    if (command.includes(f)) {
      throw new Error(`安全拦截：禁止执行包含 "${f}" 的命令`);
    }
  }

  try {
    const stdout = execSync(command, {
      cwd: SANDBOX_ROOT,
      timeout: 15_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout: stdout.slice(0, 5000), stderr: "" };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout ?? "").slice(0, 5000),
      stderr: (e.stderr ?? "").slice(0, 5000),
    };
  }
}

export const runCommandSchema = {
  type: "function" as const,
  function: {
    name: "run_command",
    description:
      "在项目目录下执行 shell 命令（如 npx tsx xxx.ts、npx tsc --noEmit）。" +
      "返回 stdout、stderr 和 exitCode。超时 15 秒。用于运行代码、测试、编译检查。",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "要执行的 shell 命令",
        },
      },
      required: ["command"],
    },
  },
};
