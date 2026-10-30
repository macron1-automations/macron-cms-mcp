import { promises as fs } from "node:fs";
import * as path from "node:path";
import { InlineFileUpload } from "./types.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".html": "text/html",
  ".txt": "text/plain",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export async function prepareLocalFileUpload(filePath: string): Promise<InlineFileUpload> {
  const resolvedPath = path.resolve(filePath.trim());

  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (err) {
    throw new Error(`Local file not found at path: "${filePath}" (resolved to: ${resolvedPath})`);
  }

  if (!stats.isFile()) {
    throw new Error(`Path is not a regular file: "${filePath}"`);
  }

  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${stats.size} bytes) exceeds maximum allowable size of 25 MB (${MAX_FILE_SIZE} bytes)`
    );
  }

  const buffer = await fs.readFile(resolvedPath);
  const data_base64 = buffer.toString("base64");
  const filename = path.basename(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const content_type = EXT_TO_MIME[ext] || "application/octet-stream";

  return {
    filename,
    content_type,
    data_base64,
  };
}
