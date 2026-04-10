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
exports.downloadFiles = downloadFiles;
exports.cleanupFiles = cleanupFiles;
const fs = __importStar(require("fs/promises"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const TEXT_EXTENSIONS = new Set([
    "js",
    "ts",
    "json",
    "csv",
    "log",
    "txt",
    "md",
    "py",
    "html",
    "css",
]);
function getThreadDir(threadTs) {
    return path.join((0, config_1.getConfig)().project.tmpDir, threadTs);
}
function sanitizeFileName(fileName) {
    const baseName = path.basename(fileName || "attachment");
    return baseName.replace(/[^\w.-]/g, "_");
}
function getFileExtension(file) {
    const extensionFromName = path.extname(file.name || "").slice(1).toLowerCase();
    if (extensionFromName) {
        return extensionFromName;
    }
    return (file.filetype || "").toLowerCase();
}
function isImageFile(file) {
    return IMAGE_EXTENSIONS.has(getFileExtension(file));
}
function isTextFile(file) {
    return TEXT_EXTENSIONS.has(getFileExtension(file));
}
function requestFile(url, token) {
    const client = url.protocol === "http:" ? http : https;
    return new Promise((resolve, reject) => {
        const req = client.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }, (res) => {
            if (res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location) {
                res.resume();
                const redirectUrl = new URL(res.headers.location, url);
                requestFile(redirectUrl, token).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                const statusCode = res.statusCode ?? "unknown";
                res.resume();
                reject(new Error(`파일 다운로드 실패 (${statusCode}): ${url.toString()}`));
                return;
            }
            const chunks = [];
            res.on("data", (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            res.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
            res.on("error", reject);
        });
        req.on("error", reject);
    });
}
async function downloadFile(file, targetDir) {
    const fileUrl = new URL(file.url_private_download);
    const fileBuffer = await requestFile(fileUrl, (0, config_1.getConfig)().slack.botToken);
    const localPath = path.join(targetDir, sanitizeFileName(file.name));
    await fs.writeFile(localPath, fileBuffer);
    return localPath;
}
async function downloadFiles(files, threadTs) {
    const targetDir = getThreadDir(threadTs);
    await fs.mkdir(targetDir, { recursive: true });
    return Promise.all(files.map(async (file) => {
        const localPath = await downloadFile(file, targetDir);
        const attachment = {
            original_name: file.name,
            local_path: localPath,
            mimetype: file.mimetype,
            is_image: isImageFile(file),
        };
        if (isTextFile(file)) {
            attachment.content = await fs.readFile(localPath, "utf8");
        }
        return attachment;
    }));
}
async function cleanupFiles(threadTs) {
    const targetDir = getThreadDir(threadTs);
    await fs.rm(targetDir, { recursive: true, force: true });
}
