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
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONFIG_DIR = path.join(process.env.HOME || "~", ".slack_code_plan");
const ENV_PATH = path.join(CONFIG_DIR, ".env");
let cachedConfig = null;
function loadConfig() {
    if (cachedConfig)
        return cachedConfig;
    // .env 파일 로드
    const env = {};
    if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match)
                env[match[1]] = match[2];
        }
    }
    const botToken = process.env.SLACK_BOT_TOKEN || env.SLACK_BOT_TOKEN || "";
    const appToken = process.env.SLACK_APP_TOKEN || env.SLACK_APP_TOKEN || "";
    if (!botToken || !appToken)
        return null;
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
function getConfig() {
    const config = loadConfig();
    if (!config) {
        throw new Error("설정이 없습니다. 먼저 실행: slack_code_plan init");
    }
    return config;
}
