import { spawn } from "child_process";
import { getConfig } from "./config";

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

      const errorMessage = stderr.trim() || stdout.trim() || "unknown error";
      reject(new Error(`${command} exited with code ${code}: ${errorMessage}`));
    });
  });
}

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

function parseClaudeOutput(stdout: string): string {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error("Claude CLI returned empty output");
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

  throw new Error("Failed to parse Claude CLI JSON output");
}

export async function runClaude(args: string[]): Promise<string> {
  const stdout = await runCommand("claude", args, getConfig().project.root);
  return parseClaudeOutput(stdout);
}
