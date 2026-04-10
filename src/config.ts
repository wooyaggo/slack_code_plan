import * as fs from "fs";
import * as path from "path";

const CONFIG_DIR = path.join(process.env.HOME || "~", ".slack_code_plan");
const ENV_PATH = path.join(CONFIG_DIR, ".env");

interface Config {
  slack: {
    botToken: string;
    appToken: string;
    botUserId: string;
  };
  project: {
    root: string;
    tmpDir: string;
  };
  classifier: {
    model: string;
  };
  session: {
    model: string;
    maxIdleMinutes: number;
  };
}

let cachedConfig: Config | null = null;

export function loadConfig(): Config | null {
  if (cachedConfig) return cachedConfig;

  // .env 파일 로드
  const env: Record<string, string> = {};
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) env[match[1]] = match[2];
    }
  }

  const botToken = process.env.SLACK_BOT_TOKEN || env.SLACK_BOT_TOKEN || "";
  const appToken = process.env.SLACK_APP_TOKEN || env.SLACK_APP_TOKEN || "";

  if (!botToken || !appToken) return null;

  cachedConfig = {
    slack: {
      botToken,
      appToken,
      botUserId: process.env.SLACK_BOT_USER_ID || env.SLACK_BOT_USER_ID || "",
    },
    project: {
      root: process.cwd(),
      tmpDir: path.join(CONFIG_DIR, "tmp"),
    },
    classifier: {
      model: "haiku",
    },
    session: {
      model: "sonnet",
      maxIdleMinutes: 60,
    },
  };

  return cachedConfig;
}

export function getConfig(): Config {
  const config = loadConfig();
  if (!config) {
    throw new Error("설정이 없습니다. 먼저 실행: slack_code_plan init");
  }
  return config;
}
