"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.continueSession = continueSession;
exports.getSession = getSession;
exports.closeSession = closeSession;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./config");
const cli_1 = require("./cli");
const sessions = new Map();
function buildPrompt(message, attachments) {
    const sections = [
        "다음은 Slack에서 들어온 QA 요청입니다.",
        "",
        "[QA 메시지]",
        message.trim() || "(메시지 없음)",
        "[/QA 메시지]",
    ];
    if (attachments.length === 0) {
        return sections.join("\n");
    }
    sections.push("", "[첨부 파일]");
    for (const attachment of attachments) {
        if (attachment.is_image) {
            sections.push(`- 이미지 첨부: ${attachment.original_name}`, `  MIME 타입: ${attachment.mimetype}`, `  파일 경로: ${attachment.local_path}`);
            continue;
        }
        sections.push(`- 텍스트 첨부: ${attachment.original_name}`, `  MIME 타입: ${attachment.mimetype}`, "[첨부 내용 시작]", attachment.content ?? `(내용 없음, 파일 경로: ${attachment.local_path})`, "[첨부 내용 끝]");
    }
    sections.push("[/첨부 파일]");
    return sections.join("\n");
}
async function createSession(threadTs, channel, message, attachments) {
    await (0, cli_1.runCommand)("git", ["pull"], (0, config_1.getConfig)().project.root);
    const sessionId = crypto_1.default.randomUUID();
    const prompt = buildPrompt(message, attachments);
    const result = await (0, cli_1.runClaude)([
        "-p",
        "--model",
        (0, config_1.getConfig)().session.model,
        "--output-format",
        "json",
        "--session-id",
        sessionId,
        "--system-prompt",
        "이 QA 요청을 분석하고 실행 가능한 플랜을 짜라. 한국어로 답변. 정보가 부족할 시 최근 작업 기록을 참고하고 작업 계획 이외에는 어떤 메세지도 출력하지 않는다. (단, 메세지는 Slack 에서 잘 보여지도록 포맷을 갖춘다.)",
        prompt,
    ]);
    sessions.set(threadTs, {
        session_id: sessionId,
        thread_ts: threadTs,
        channel,
        status: "active",
        created_at: Date.now(),
    });
    return result;
}
async function continueSession(threadTs, message, attachments) {
    const session = sessions.get(threadTs);
    if (!session) {
        throw new Error(`Session not found for thread ${threadTs}`);
    }
    if (session.status === "closed") {
        throw new Error(`Session is closed for thread ${threadTs}`);
    }
    const prompt = buildPrompt(message, attachments);
    const result = await (0, cli_1.runClaude)([
        "-p",
        "--resume",
        session.session_id,
        "--model",
        (0, config_1.getConfig)().session.model,
        "--output-format",
        "json",
        prompt,
    ]);
    session.status = "active";
    return result;
}
function getSession(threadTs) {
    return sessions.get(threadTs);
}
function closeSession(threadTs) {
    const session = sessions.get(threadTs);
    if (!session) {
        return;
    }
    session.status = "closed";
}
