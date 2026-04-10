import { WebClient } from "@slack/web-api";
import { getConfig } from "./config";

const SLACK_MESSAGE_LIMIT = 4000;

let client: WebClient;
function getClient(): WebClient {
  if (!client) client = new WebClient(getConfig().slack.botToken);
  return client;
}

/**
 * 텍스트를 논리적 경계(빈 줄, 코드블록 끝)에서 분할한다.
 * 각 청크는 SLACK_MESSAGE_LIMIT 이하.
 */
function splitMessage(text: string): string[] {
  if (text.length <= SLACK_MESSAGE_LIMIT) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= SLACK_MESSAGE_LIMIT) {
      chunks.push(remaining);
      break;
    }

    const segment = remaining.slice(0, SLACK_MESSAGE_LIMIT);
    let splitIndex = -1;

    // 코드블록 끝(```) 뒤의 줄바꿈을 우선 탐색
    const codeBlockEnd = segment.lastIndexOf("```\n");
    if (codeBlockEnd !== -1) {
      splitIndex = codeBlockEnd + 4; // ``` + \n
    }

    // 빈 줄 기준 분할
    if (splitIndex === -1) {
      const emptyLine = segment.lastIndexOf("\n\n");
      if (emptyLine !== -1) {
        splitIndex = emptyLine + 2;
      }
    }

    // 일반 줄바꿈 기준 분할
    if (splitIndex === -1) {
      const newline = segment.lastIndexOf("\n");
      if (newline !== -1) {
        splitIndex = newline + 1;
      }
    }

    // 줄바꿈이 전혀 없으면 강제 분할
    if (splitIndex === -1) {
      splitIndex = SLACK_MESSAGE_LIMIT;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }

  return chunks;
}

export async function postStatus(
  channel: string,
  threadTs: string,
  text: string,
): Promise<string> {
  const result = await getClient().chat.postMessage({
    channel,
    thread_ts: threadTs,
    text,
  });
  return result.ts as string;
}

export async function updateStatus(
  channel: string,
  messageTs: string,
  text: string,
): Promise<void> {
  await getClient().chat.update({
    channel,
    ts: messageTs,
    text,
  });
}

export async function replyToThread(
  channel: string,
  threadTs: string,
  text: string,
): Promise<void> {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await getClient().chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: chunk,
    });
  }
}

export async function uploadSnippet(
  channel: string,
  threadTs: string,
  content: string,
  filename: string,
): Promise<void> {
  await getClient().filesUploadV2({
    channel_id: channel,
    thread_ts: threadTs,
    content,
    filename,
  });
}

export async function postError(
  channel: string,
  threadTs: string,
  error: string,
): Promise<void> {
  const formatted = `[ERROR] ${error}`;

  await getClient().chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: formatted,
  });
}
