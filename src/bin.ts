#!/usr/bin/env node

import { spawnSync } from "child_process";
import * as path from "path";

import { init } from "./init";
import { startMonitor } from "./slack_monitor";
import { loadConfig } from "./config";

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  console.log(`
slack_code_plan - Slack 채널 모니터링 & Claude Code 자동 플랜 수립

사용법:
  slack_code_plan init                         토큰 설정 (최초 1회)
  slack_code_plan start <CHANNEL_ID>           모니터링 시작
  slack_code_plan start <CHANNEL_ID> --pm2     pm2로 백그라운드 실행
  slack_code_plan --help                       도움말
`);
}

function startWithPm2(channelId: string): never {
  const scriptPath = path.resolve(__filename);
  const processName = `slack_code_plan-${channelId}`;
  const result = spawnSync(
    "pm2",
    [
      "start",
      scriptPath,
      "--name",
      processName,
      "--interpreter",
      process.execPath,
      "--",
      "start",
      channelId,
    ],
    { stdio: "inherit" },
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error("pm2 명령을 찾을 수 없습니다. pm2를 먼저 설치해 주세요.");
    } else {
      console.error("pm2 실행 실패:", result.error.message);
    }
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "init") {
  init().then(() => process.exit(0)).catch((err) => {
    console.error("init 실패:", err);
    process.exit(1);
  });
} else if (command === "start") {
  const startArgs = args.slice(1);
  const channelId = startArgs.find((arg) => !arg.startsWith("-"));
  const usePm2 = startArgs.includes("--pm2");

  if (!channelId) {
    console.error("사용법: slack_code_plan start <CHANNEL_ID> [--pm2]");
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    console.error("설정이 없습니다. 먼저 실행: slack_code_plan init");
    process.exit(1);
  }

  if (usePm2) {
    console.log(`[slack_code_plan] 채널 ${channelId} 모니터링을 pm2로 실행합니다...`);
    startWithPm2(channelId);
  }

  console.log(`[slack_code_plan] 채널 ${channelId} 모니터링 시작...`);
  startMonitor(channelId);

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
} else {
  console.error(`알 수 없는 커맨드: ${command}`);
  console.error("slack_code_plan --help 로 사용법을 확인해 주세요.");
  process.exit(1);
}
