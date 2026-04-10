import { App, LogLevel } from "@slack/bolt";
import { getConfig } from "./config";
import { classifyMessage, recordMissedExample } from "./classifier";
import { downloadFiles } from "./attachment_handler";
import { createSession, continueSession, getSession } from "./session_manager";
import { postStatus, updateStatus } from "./responder";
import type { SlackMessage, SlackFile } from "./types";

let app: App;
let monitoringChannelId: string;
let botUserId: string;

function isEmptySystemEvent(message: any): boolean {
  return !message.user && !message.bot_id && !message.subtype && !(message.text || "").trim() && !(message.files?.length);
}

function isBotMentioned(text: string): boolean {
  return botUserId ? text.includes(`<@${botUserId}>`) : false;
}

function stripBotMention(text: string): string {
  return botUserId ? text.replace(`<@${botUserId}>`, "").trim() : text;
}

export async function startMonitor(channelId: string): Promise<void> {
  monitoringChannelId = channelId;

  app = new App({
    token: getConfig().slack.botToken,
    appToken: getConfig().slack.appToken,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  // 봇 ID 설정
  if (getConfig().slack.botUserId) {
    botUserId = getConfig().slack.botUserId;
  } else {
    const auth = await app.client.auth.test({ token: getConfig().slack.botToken });
    botUserId = auth.user_id as string;
  }
  console.log(`[slack_monitor] 봇 ID: ${botUserId}`);

  app.message(async ({ message }) => {
    try {
      await handleMessage(message as any);
    } catch (err) {
      console.error("[slack_monitor] 메시지 처리 실패:", err);
    }
  });

  await app.start();
  console.log(`[slack_monitor] 채널 ${channelId} 모니터링 시작`);
}

async function handleMessage(message: any): Promise<void> {
  if (isEmptySystemEvent(message)) {
    return;
  }

  console.log(`[slack_monitor] 메시지 수신 - channel: ${message.channel}, user: ${message.user}, ts: ${message.ts}, thread_ts: ${message.thread_ts || "없음"}, text: "${(message.text || "").slice(0, 80)}", files: ${message.files?.length || 0}개`);

  if (message.bot_id || message.subtype === "bot_message" || !message.user || message.subtype === "message_changed") {
    console.log("[slack_monitor] 봇/시스템 메시지 → 무시");
    return;
  }

  if (message.channel !== monitoringChannelId) {
    console.log(`[slack_monitor] 대상 채널 아님 → 무시`);
    return;
  }

  const slackMessage: SlackMessage = {
    text: message.text || "",
    user: message.user,
    ts: message.ts,
    thread_ts: message.thread_ts,
    channel: message.channel,
    files: message.files as SlackFile[] | undefined,
  };

  // 스레드 메시지 → 기존 세션에 라우팅
  if (slackMessage.thread_ts) {
    console.log(`[slack_monitor] 스레드 메시지 → handleThreadMessage`);
    await handleThreadMessage(slackMessage);
    return;
  }

  // 새 메시지 처리
  await handleNewMessage(slackMessage);
}

async function handleNewMessage(message: SlackMessage): Promise<void> {
  const mentioned = isBotMentioned(message.text);

  if (mentioned) {
    console.log("[slack_monitor] @slack_code 멘션 감지 → 강제 QA 처리");
    await recordMissedExample(stripBotMention(message.text));
  } else {
    // 자동 분류
    const attachmentNames = message.files?.map((f) => f.name) || [];
    console.log(`[slack_monitor] 분류 요청 중... (text: "${message.text.slice(0, 50)}")`);
    const classifyStart = Date.now();
    const result = await classifyMessage(message.text, attachmentNames);
    console.log(`[slack_monitor] 분류 완료 (${Date.now() - classifyStart}ms): ${result.type} (${result.urgency}) - ${result.summary}`);

    if (result.type === "chat") {
      console.log("[slack_monitor] 잡담 → 무시");
      return;
    }
  }

  // QA 메시지 → 세션 생성
  const cleanText = mentioned ? stripBotMention(message.text) : message.text;
  const statusTs = await postStatus(message.channel, message.ts, "작업 내용 파악 중...");

  try {
    let attachments: any[] = [];
    if (message.files) {
      await updateStatus(message.channel, statusTs, "첨부파일 다운로드 중...");
      attachments = await downloadFiles(message.files, message.ts);
    }

    await updateStatus(message.channel, statusTs, "코드베이스 분석 및 플랜 수립 중...");
    const plan = await createSession(
      message.ts,
      message.channel,
      cleanText,
      attachments
    );

    await updateStatus(message.channel, statusTs, plan);
  } catch (err) {
    console.error("[slack_monitor] 세션 생성 실패:", err);
    await updateStatus(message.channel, statusTs, `세션 생성 실패: ${(err as Error).message}`);
  }
}

async function fetchThreadMessages(channel: string, threadTs: string): Promise<string> {
  const result = await app.client.conversations.replies({
    token: getConfig().slack.botToken,
    channel,
    ts: threadTs,
  });

  if (!result.messages || result.messages.length === 0) return "";

  return result.messages
    .filter((m: any) => !m.bot_id && m.subtype !== "bot_message")
    .map((m: any) => m.text || "")
    .filter(Boolean)
    .join("\n\n");
}

async function handleThreadMessage(message: SlackMessage): Promise<void> {
  const mentioned = isBotMentioned(message.text);
  const session = getSession(message.thread_ts!);

  if (!session && !mentioned) {
    console.log(`[slack_monitor] 스레드 ${message.thread_ts} → 관리 대상 아님, 무시`);
    return;
  }

  const cleanText = mentioned ? stripBotMention(message.text) : message.text;
  const statusTs = await postStatus(message.channel, message.thread_ts!, "작업 내용 파악 중...");

  try {
    let attachments: any[] = [];
    if (message.files) {
      await updateStatus(message.channel, statusTs, "첨부파일 다운로드 중...");
      attachments = await downloadFiles(message.files, message.thread_ts!);
    }

    if (!session) {
      await updateStatus(message.channel, statusTs, "스레드 대화 수집 중...");
      const threadContext = await fetchThreadMessages(message.channel, message.thread_ts!);

      await recordMissedExample(threadContext.split("\n\n")[0] || cleanText);

      await updateStatus(message.channel, statusTs, "코드베이스 분석 및 플랜 수립 중...");
      const plan = await createSession(
        message.thread_ts!,
        message.channel,
        threadContext,
        attachments
      );
      await updateStatus(message.channel, statusTs, plan);
    } else {
      await updateStatus(message.channel, statusTs, "응답 생성 중...");
      const response = await continueSession(
        message.thread_ts!,
        cleanText,
        attachments
      );
      await updateStatus(message.channel, statusTs, response);
    }
  } catch (err) {
    console.error("[slack_monitor] 세션 응답 실패:", err);
    await updateStatus(
      message.channel,
      statusTs,
      `응답 실패: ${(err as Error).message}`
    );
  }
}

export function stopMonitor(): void {
  if (app) {
    app.stop();
    console.log("[slack_monitor] 모니터링 중지");
  }
}
