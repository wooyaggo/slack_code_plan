import crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { runCommand } from "./cli";
import { getConfig } from "./config";
import type { ClassifyResult } from "./types";

const MISSED_EXAMPLES_PATH = path.resolve(__dirname, "missed_examples.json");

const BASE_SYSTEM_PROMPT = `메시지를 읽고 개발 작업이 필요한 메시지인지 판단해라. 1 아니면 0만 출력해라. 다른 텍스트는 절대 출력하지 마라.

1: 코드 수정, 버그 수정, UI 변경, 문구 변경, 기능 추가/삭제 등 개발 작업이 필요한 메시지
0: 인사, 잡담, 공유, 회의, 일정 등 개발 작업이 필요 없는 메시지`;

const DEFAULT_RESULT: ClassifyResult = {
  type: "chat",
  summary: "",
  urgency: "low",
};

interface MissedExample {
  text: string;
  timestamp: string;
}

let classifierSessionId: string | null = null;
let sessionInitialized = false;

async function loadMissedExamples(): Promise<MissedExample[]> {
  try {
    const data = await fs.readFile(MISSED_EXAMPLES_PATH, "utf8");
    return JSON.parse(data) as MissedExample[];
  } catch {
    return [];
  }
}

export async function recordMissedExample(text: string): Promise<void> {
  const examples = await loadMissedExamples();

  if (examples.some((e) => e.text === text)) return;

  examples.push({ text, timestamp: new Date().toISOString() });

  const trimmed = examples.slice(-50);
  await fs.writeFile(MISSED_EXAMPLES_PATH, JSON.stringify(trimmed, null, 2));

  // 프롬프트 변경 → 세션 리셋
  classifierSessionId = null;
  sessionInitialized = false;
  console.log(`[classifier] 오분류 사례 기록 (총 ${trimmed.length}건)`);
}

async function buildSystemPrompt(): Promise<string> {
  const examples = await loadMissedExamples();

  if (examples.length === 0) return BASE_SYSTEM_PROMPT;

  const exampleLines = examples
    .slice(-20)
    .map((e) => `- "${e.text}"`)
    .join("\n");

  return `${BASE_SYSTEM_PROMPT}

아래 메시지들은 개발 작업이 필요한 메시지였다. 비슷한 패턴은 반드시 1로 판단해라.
${exampleLines}`;
}

async function initSession(): Promise<string> {
  if (classifierSessionId && sessionInitialized) return classifierSessionId;

  classifierSessionId = crypto.randomUUID();
  const systemPrompt = await buildSystemPrompt();
  console.log(`[classifier] 분류 세션 초기화 시작 (session: ${classifierSessionId}, promptLength: ${systemPrompt.length})`);

  // 첫 호출: --session-id로 새 세션 생성
  await runCommand("claude", [
    "-p",
    "--model",
    getConfig().classifier.model,
    "--output-format",
    "text",
    "--session-id",
    classifierSessionId,
    "--system-prompt",
    systemPrompt,
    "준비 완료. 이후 메시지를 분류해라.",
  ], getConfig().project.root);

  sessionInitialized = true;
  console.log(`[classifier] 분류 세션 초기화 완료 (session: ${classifierSessionId})`);
  return classifierSessionId;
}

export async function classifyMessage(
  text: string,
  attachmentNames?: string[],
): Promise<ClassifyResult> {
  let userContent = text;
  console.log(`[classifier] classifyMessage 시작 (textLength: ${text.length}, attachments: ${attachmentNames?.join(", ") || "없음"})`);

  if (attachmentNames && attachmentNames.length > 0) {
    userContent += `\n\n[첨부파일: ${attachmentNames.join(", ")}]`;
  }

  try {
    const sessionId = await initSession();
    console.log(`[classifier] 분류 세션 사용 (session: ${sessionId}, userContentLength: ${userContent.length})`);

    // --resume으로 기존 세션 이어가기
    const raw = await runCommand("claude", [
      "-p",
      "--model",
      getConfig().classifier.model,
      "--output-format",
      "text",
      "--resume",
      sessionId,
      userContent,
    ], getConfig().project.root);

    const trimmed = raw.trim();
    console.log(`[classifier] raw output: ${trimmed}`);

    const isQa = trimmed.includes("1");

    return {
      type: isQa ? "qa" : "chat",
      summary: "",
      urgency: "low",
    };
  } catch (err) {
    console.error(`[classifier] 에러:`, err);
    return DEFAULT_RESULT;
  }
}
