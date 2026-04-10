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
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const CONFIG_DIR = path.join(process.env.HOME || "~", ".slack_code_plan");
const ENV_PATH = path.join(CONFIG_DIR, ".env");
function ask(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}
async function init() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log("\n[ slack_code_plan 초기 설정 ]\n");
    // 기존 설정 로드
    let existing = {};
    if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match)
                existing[match[1]] = match[2];
        }
        console.log("기존 설정 발견. 빈 값 입력 시 기존 값 유지.\n");
    }
    const botToken = await ask(rl, `Slack Bot Token (xoxb-...)${existing.SLACK_BOT_TOKEN ? ` [${existing.SLACK_BOT_TOKEN.slice(0, 15)}...]` : ""}: `);
    const appToken = await ask(rl, `Slack App Token (xapp-...)${existing.SLACK_APP_TOKEN ? ` [${existing.SLACK_APP_TOKEN.slice(0, 15)}...]` : ""}: `);
    const botUserId = await ask(rl, `Slack Bot User ID (선택, 비워도 됨)${existing.SLACK_BOT_USER_ID ? ` [${existing.SLACK_BOT_USER_ID}]` : ""}: `);
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
}
