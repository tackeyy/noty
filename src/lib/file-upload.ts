/**
 * Notion Direct File Upload
 *
 * 3-step flow:
 *  1. POST /v1/file_uploads                       → create upload session → { id }
 *  2. POST /v1/file_uploads/{id}/send             → upload file bytes (multipart/form-data)
 *  3. POST /v1/file_uploads/{id}/complete         → finalize → { status: "uploaded" }
 *
 * Max single-part size: 5 MB
 * Ref: https://developers.notion.com/reference/file-upload
 */

import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import type { FileUploadResult } from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_SINGLE_PART_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileUploadDeps {
  token: string;
  fetchImpl?: typeof fetch;
}

function getHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    ...extra,
  };
}

async function apiPost(
  url: string,
  token: string,
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: getHeaders(token, body !== undefined ? { "Content-Type": "application/json" } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json() as Record<string, unknown>;
      detail = errBody.message ? ` — ${errBody.message}` : ` — ${JSON.stringify(errBody)}`;
    } catch {
      detail = ` — ${await res.text().catch(() => "(no body)")}`;
    }
    throw new Error(`Notion API error ${res.status} (${url})${detail}`);
  }

  return res.json();
}

/**
 * Perform the 3-step Notion Direct Upload.
 * Returns the completed FileUploadResult.
 */
export async function uploadFileToNotion(
  filePath: string,
  deps: FileUploadDeps,
): Promise<FileUploadResult> {
  const { token, fetchImpl = fetch } = deps;

  // Validate file exists and check size
  let fileSize: number;
  try {
    const stat = statSync(filePath);
    fileSize = stat.size;
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  if (fileSize > MAX_SINGLE_PART_BYTES) {
    throw new Error(
      `File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds the 5 MB single-part limit. ` +
      `Multi-part uploads are not yet supported.`,
    );
  }

  const filename = basename(filePath);

  // Step 1: Create upload session
  const session = await apiPost(
    `${NOTION_API_BASE}/file_uploads`,
    token,
    {},
    fetchImpl,
  ) as { id: string; created_time?: string; expiry_time?: string };

  const uploadId = session.id;
  if (!uploadId) {
    throw new Error("Notion API did not return a file upload ID");
  }

  // Step 2: Send file (multipart/form-data)
  const formData = new FormData();
  // Read file into a Blob for FormData compatibility with Node.js built-in fetch
  const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  const mimeType = getMimeType(filename);
  // Pass MIME type inside the Blob so the multipart Content-Type header is set correctly.
  // Notion rejects "application/octet-stream" for known file types.
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("file", blob, filename);

  const sendRes = await fetchImpl(`${NOTION_API_BASE}/file_uploads/${uploadId}/send`, {
    method: "POST",
    headers: getHeaders(token), // Do NOT set Content-Type; browser/node sets it with boundary
    body: formData,
  });

  // Parse body once (Response body can only be consumed once)
  let sendBody: { id?: string; status?: string; created_time?: string; expiry_time?: string };
  try {
    sendBody = await sendRes.json() as typeof sendBody;
  } catch {
    sendBody = {};
  }

  if (!sendRes.ok) {
    const detail = (sendBody as any).message
      ? ` — ${(sendBody as any).message}`
      : ` — ${JSON.stringify(sendBody)}`;
    throw new Error(`Notion API error ${sendRes.status} (send)${detail}`);
  }

  // Step 3: Check if /send already finalized the upload.
  // Notion marks the upload as "uploaded" after /send for single-part uploads.
  // The /complete endpoint only applies to multi-part uploads still in "pending" state.
  // If already "uploaded" (single-part), skip /complete
  if (sendBody.status === "uploaded") {
    return {
      id: sendBody.id ?? uploadId,
      status: "uploaded",
      createdTime: sendBody.created_time ?? session.created_time ?? "",
      expiryTime: sendBody.expiry_time ?? session.expiry_time ?? "",
      filename,
    };
  }

  // Otherwise call /complete (multi-part scenario)
  const completed = await apiPost(
    `${NOTION_API_BASE}/file_uploads/${uploadId}/complete`,
    token,
    {},
    fetchImpl,
  ) as {
    id: string;
    status?: string;
    created_time?: string;
    expiry_time?: string;
  };

  return {
    id: completed.id ?? uploadId,
    status: (completed.status as FileUploadResult["status"]) ?? "uploaded",
    createdTime: completed.created_time ?? session.created_time ?? "",
    expiryTime: completed.expiry_time ?? session.expiry_time ?? "",
    filename,
  };
}

/**
 * Build a `file` block referencing a completed file_upload.
 */
export function buildFileBlock(
  fileUploadId: string,
  caption?: string,
): Record<string, unknown> {
  const captionBlocks = caption
    ? [{ type: "text", text: { content: caption } }]
    : [];

  return {
    type: "file",
    file: {
      type: "file_upload",
      file_upload: { id: fileUploadId },
      caption: captionBlocks,
    },
  };
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? "application/octet-stream";
}
