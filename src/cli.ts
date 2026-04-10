import { spawn } from "child_process";
import { getConfig } from "./config";

function extractResultText(payload: unknown): string | undefined {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(payload)) {
    const parts = payload
      .map((item) => extractResultText(item))
      .filter((item): item is string => Boolean(item));

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["result", "text", "message", "content"]) {
    const extracted = extractResultText(record[key]);
    if (extracted) {
      return extracted;
    }
  }

  for (const value of Object.values(record)) {
    const extracted = extractResultText(value);
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
}

function parseStructuredOutput(output: string): string | undefined {
  const trimmed = output.trim();

  if (!trimmed) {
    return undefined;
  }

  const candidates = [
    trimmed,
    ...trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse(),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const resultText = extractResultText(parsed);
      if (resultText) {
        return resultText;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function formatCommandError(command: string, stdout: string, stderr: string, code: number | null): string {
  const rawMessage =
    parseStructuredOutput(stderr) ||
    parseStructuredOutput(stdout) ||
    stderr.trim() ||
    stdout.trim() ||
    "unknown error";

  if (command === "claude") {
    if (
      rawMessage.includes("Failed to authenticate") ||
      rawMessage.includes("Invalid authentication credentials") ||
      rawMessage.includes("authentication_error")
    ) {
      return "Claude 인증에 실패했습니다. PM2 프로세스에서 사용할 Claude CLI 인증 또는 API 키를 확인해 주세요.";
    }

    if (rawMessage.includes("not found")) {
      return "Claude CLI를 찾을 수 없습니다. 실행 환경의 PATH를 확인해 주세요.";
    }
  }

  return `${command} exited with code ${code}: ${rawMessage}`;
}

export function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(formatCommandError(command, stdout, stderr, code)));
    });
  });
}

function parseClaudeOutput(stdout: string): string {
  if (!stdout.trim()) {
    throw new Error("Claude CLI returned empty output");
  }

  const parsed = parseStructuredOutput(stdout);
  if (parsed) {
    return parsed;
  }

  throw new Error("Failed to parse Claude CLI JSON output");
}

export async function runClaude(args: string[]): Promise<string> {
  const stdout = await runCommand("claude", args, getConfig().project.root);
  return parseClaudeOutput(stdout);
}
