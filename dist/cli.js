"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
exports.runClaude = runClaude;
const child_process_1 = require("child_process");
const config_1 = require("./config");
function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
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
function extractResultText(payload) {
    if (typeof payload === "string") {
        const trimmed = payload.trim();
        return trimmed || undefined;
    }
    if (Array.isArray(payload)) {
        const parts = payload
            .map((item) => extractResultText(item))
            .filter((item) => Boolean(item));
        return parts.length > 0 ? parts.join("\n\n") : undefined;
    }
    if (!payload || typeof payload !== "object") {
        return undefined;
    }
    const record = payload;
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
function parseClaudeOutput(stdout) {
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
        }
        catch {
            continue;
        }
    }
    throw new Error("Failed to parse Claude CLI JSON output");
}
async function runClaude(args) {
    const stdout = await runCommand("claude", args, (0, config_1.getConfig)().project.root);
    return parseClaudeOutput(stdout);
}
