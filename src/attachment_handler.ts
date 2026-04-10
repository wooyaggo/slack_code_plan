import * as fs from "fs/promises";
import * as http from "http";
import * as https from "https";
import * as path from "path";

import { getConfig } from "./config";
import type { ProcessedAttachment, SlackFile } from "./types";

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

function getThreadDir(threadTs: string): string {
  return path.join(getConfig().project.tmpDir, threadTs);
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName || "attachment");
  return baseName.replace(/[^\w.-]/g, "_");
}

function getFileExtension(file: SlackFile): string {
  const extensionFromName = path.extname(file.name || "").slice(1).toLowerCase();

  if (extensionFromName) {
    return extensionFromName;
  }

  return (file.filetype || "").toLowerCase();
}

function isImageFile(file: SlackFile): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(file));
}

function isTextFile(file: SlackFile): boolean {
  return TEXT_EXTENSIONS.has(getFileExtension(file));
}

function requestFile(url: URL, token: string): Promise<Buffer> {
  const client = url.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res: http.IncomingMessage) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
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

        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        res.on("error", reject);
      }
    );

    req.on("error", reject);
  });
}

async function downloadFile(file: SlackFile, targetDir: string): Promise<string> {
  const fileUrl = new URL(file.url_private_download);
  const fileBuffer = await requestFile(fileUrl, getConfig().slack.botToken);
  const localPath = path.join(targetDir, sanitizeFileName(file.name));

  await fs.writeFile(localPath, fileBuffer);

  return localPath;
}

export async function downloadFiles(
  files: SlackFile[],
  threadTs: string
): Promise<ProcessedAttachment[]> {
  const targetDir = getThreadDir(threadTs);

  await fs.mkdir(targetDir, { recursive: true });

  return Promise.all(
    files.map(async (file) => {
      const localPath = await downloadFile(file, targetDir);
      const attachment: ProcessedAttachment = {
        original_name: file.name,
        local_path: localPath,
        mimetype: file.mimetype,
        is_image: isImageFile(file),
      };

      if (isTextFile(file)) {
        attachment.content = await fs.readFile(localPath, "utf8");
      }

      return attachment;
    })
  );
}

export async function cleanupFiles(threadTs: string): Promise<void> {
  const targetDir = getThreadDir(threadTs);
  await fs.rm(targetDir, { recursive: true, force: true });
}
