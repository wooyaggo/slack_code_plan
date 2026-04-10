import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const CONFIG_DIR = path.join(process.env.HOME || "~", ".slack_code_plan");
const ENV_PATH = path.join(CONFIG_DIR, ".env");
const CLAUDE_ALLOWED_TOOLS = [
  "Read",
  "LS",
  "Glob",
  "Grep",
  "Edit",
  "MultiEdit",
  "Write",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git push:*)",
];

function ensureClaudeSettings(projectRoot: string): void {
  const claudeSettingsDir = path.join(projectRoot, ".claude");
  const claudeSettingsPath = path.join(claudeSettingsDir, "settings.json");

  fs.mkdirSync(claudeSettingsDir, { recursive: true });

  let settings: Record<string, any> = {};
  if (fs.existsSync(claudeSettingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(claudeSettingsPath, "utf8"));
    } catch (error) {
      throw new Error(
        `.claude/settings.json 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const permissions =
    settings.permissions && typeof settings.permissions === "object"
      ? { ...settings.permissions }
      : {};

  const existingAllow = Array.isArray(permissions.allow) ? permissions.allow : [];
  permissions.allow = Array.from(new Set([...existingAllow, ...CLAUDE_ALLOWED_TOOLS]));
  settings.permissions = permissions;

  fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Claude Code 권한 설정 저장 완료: ${path.join(projectRoot, ".claude/settings.json")}`);
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function init(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n[ slack_code_plan 초기 설정 ]\n");

  // 기존 설정 로드
  let existing: Record<string, string> = {};
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) existing[match[1]] = match[2];
    }
    console.log("기존 설정 발견. 빈 값 입력 시 기존 값 유지.\n");
  }

  const botToken = await ask(
    rl,
    `Slack Bot Token (xoxb-...)${existing.SLACK_BOT_TOKEN ? ` [${existing.SLACK_BOT_TOKEN.slice(0, 15)}...]` : ""}: `,
  );

  const appToken = await ask(
    rl,
    `Slack App Token (xapp-...)${existing.SLACK_APP_TOKEN ? ` [${existing.SLACK_APP_TOKEN.slice(0, 15)}...]` : ""}: `,
  );

  const botUserId = await ask(
    rl,
    `Slack Bot User ID (선택, 비워도 됨)${existing.SLACK_BOT_USER_ID ? ` [${existing.SLACK_BOT_USER_ID}]` : ""}: `,
  );

  rl.close();

  const env = {
    SLACK_BOT_TOKEN: botToken || existing.SLACK_BOT_TOKEN || "",
    SLACK_APP_TOKEN: appToken || existing.SLACK_APP_TOKEN || "",
    SLACK_BOT_USER_ID: botUserId || existing.SLACK_BOT_USER_ID || "",
  };

  if (!env.SLACK_BOT_TOKEN || !env.SLACK_APP_TOKEN) {
    console.error("\nBot Token과 App Token은 필수입니다.");
    process.exit(1);
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  const envContent = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  fs.writeFileSync(ENV_PATH, envContent + "\n");
  console.log(`\n설정 저장 완료: ${ENV_PATH}`);
  ensureClaudeSettings(process.cwd());
}
