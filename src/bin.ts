#!/usr/bin/env node

import { init } from "./init";
import { startMonitor } from "./slack_monitor";
import { loadConfig } from "./config";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(`
slack_code_plan - Slack 채널 모니터링 & Claude Code 자동 플랜 수립

사용법:
  slack_code_plan init              토큰 설정 (최초 1회)
  slack_code_plan start <CHANNEL_ID>  모니터링 시작
  slack_code_plan --help            도움말
`);
  process.exit(0);
}

if (command === "init") {
  init().then(() => process.exit(0)).catch((err) => {
    console.error("init 실패:", err);
    process.exit(1);
  });
} else if (command === "start") {
  const channelId = process.argv[3];
  if (!channelId) {
    console.error("사용법: slack_code_plan start <CHANNEL_ID>");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    console.error("설정이 없습니다. 먼저 실행: slack_code_plan init");
    process.exit(1);
  }

  console.log(`[slack_code_plan] 채널 ${channelId} 모니터링 시작...`);
  startMonitor(channelId);

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
} else {
  console.error(`알 수 없는 커맨드: ${command}`);
  console.error("slack_code_plan --help 로 사용법을 확인하세요.");
  process.exit(1);
}
