"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordMissedExample = recordMissedExample;
exports.classifyMessage = classifyMessage;
const crypto_1 = __importDefault(require("crypto"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const cli_1 = require("./cli");
const config_1 = require("./config");
const MISSED_EXAMPLES_PATH = path.resolve(__dirname, "missed_examples.json");
const BASE_SYSTEM_PROMPT = `메시지를 읽고 개발 작업이 필요한 메시지인지 판단해라. 1 아니면 0만 출력해라. 다른 텍스트는 절대 출력하지 마라.

1: 코드 수정, 버그 수정, UI 변경, 문구 변경, 기능 추가/삭제 등 개발 작업이 필요한 메시지
0: 인사, 잡담, 공유, 회의, 일정 등 개발 작업이 필요 없는 메시지`;
const DEFAULT_RESULT = {
    type: "chat",
    summary: "",
    urgency: "low",
};
let classifierSessionId = null;
let sessionInitialized = false;
async function loadMissedExamples() {
    try {
        const data = await fs.readFile(MISSED_EXAMPLES_PATH, "utf8");
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
async function recordMissedExample(text) {
    const examples = await loadMissedExamples();
    if (examples.some((e) => e.text === text))
        return;
    examples.push({ text, timestamp: new Date().toISOString() });
    const trimmed = examples.slice(-50);
    await fs.writeFile(MISSED_EXAMPLES_PATH, JSON.stringify(trimmed, null, 2));
    // 프롬프트 변경 → 세션 리셋
    classifierSessionId = null;
    sessionInitialized = false;
    console.log(`[classifier] 오분류 사례 기록 (총 ${trimmed.length}건)`);
}
async function buildSystemPrompt() {
    const examples = await loadMissedExamples();
    if (examples.length === 0)
        return BASE_SYSTEM_PROMPT;
    const exampleLines = examples
        .slice(-20)
        .map((e) => `- "${e.text}"`)
        .join("\n");
    return `${BASE_SYSTEM_PROMPT}

아래 메시지들은 개발 작업이 필요한 메시지였다. 비슷한 패턴은 반드시 1로 판단해라.
${exampleLines}`;
}
async function initSession() {
    if (classifierSessionId && sessionInitialized)
        return classifierSessionId;
    classifierSessionId = crypto_1.default.randomUUID();
    const systemPrompt = await buildSystemPrompt();
    // 첫 호출: --session-id로 새 세션 생성
    await (0, cli_1.runCommand)("claude", [
        "-p",
        "--model",
        (0, config_1.getConfig)().classifier.model,
        "--output-format",
        "text",
        "--session-id",
        classifierSessionId,
        "--system-prompt",
        systemPrompt,
        "준비 완료. 이후 메시지를 분류해라.",
    ], (0, config_1.getConfig)().project.root);
    sessionInitialized = true;
    console.log(`[classifier] 분류 세션 초기화 완료 (session: ${classifierSessionId})`);
    return classifierSessionId;
}
async function classifyMessage(text, attachmentNames) {
    let userContent = text;
    if (attachmentNames && attachmentNames.length > 0) {
        userContent += `\n\n[첨부파일: ${attachmentNames.join(", ")}]`;
    }
    try {
        const sessionId = await initSession();
        // --resume으로 기존 세션 이어가기
        const raw = await (0, cli_1.runCommand)("claude", [
            "-p",
            "--model",
            (0, config_1.getConfig)().classifier.model,
            "--output-format",
            "text",
            "--resume",
            sessionId,
            userContent,
        ], (0, config_1.getConfig)().project.root);
        const trimmed = raw.trim();
        console.log(`[classifier] raw output: ${trimmed}`);
        const isQa = trimmed.includes("1");
        return {
            type: isQa ? "qa" : "chat",
            summary: "",
            urgency: "low",
        };
    }
    catch (err) {
        console.error(`[classifier] 에러:`, err);
        return DEFAULT_RESULT;
    }
}
