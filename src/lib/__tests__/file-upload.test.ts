import { describe, it, expect, vi } from "vitest";
import { uploadFileToNotion, buildFileBlock } from "../file-upload.js";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// -----------------------------------------------------------------------
// buildFileBlock
// -----------------------------------------------------------------------
describe("buildFileBlock", () => {
  it("returns a file block with the given upload id and no caption", () => {
    const block = buildFileBlock("upload-id-123");
    expect(block).toEqual({
      type: "file",
      file: {
        type: "file_upload",
        file_upload: { id: "upload-id-123" },
        caption: [],
      },
    });
  });

  it("includes caption rich text when caption is provided", () => {
    const block = buildFileBlock("upload-id-456", "My PDF") as any;
    expect(block.file.caption).toEqual([
      { type: "text", text: { content: "My PDF" } },
    ]);
  });
});

// -----------------------------------------------------------------------
// uploadFileToNotion
// -----------------------------------------------------------------------
describe("uploadFileToNotion", () => {
  const tmpDir = join(tmpdir(), `noty-file-upload-test-${Date.now()}`);

  function makeTmpFile(name: string, content: string = "hello"): string {
    mkdirSync(tmpDir, { recursive: true });
    const p = join(tmpDir, name);
    writeFileSync(p, content);
    return p;
  }

  function cleanTmpFile(p: string): void {
    try { unlinkSync(p); } catch { /* ignore */ }
  }

  it("throws an error when the file does not exist", async () => {
    await expect(
      uploadFileToNotion("/nonexistent/path/file.pdf", { token: "ntn_test" }),
    ).rejects.toThrow("File not found");
  });

  it("throws an error when the file exceeds 5 MB", async () => {
    const bigFile = makeTmpFile("big.bin", "x".repeat(6 * 1024 * 1024));
    try {
      await expect(
        uploadFileToNotion(bigFile, { token: "ntn_test" }),
      ).rejects.toThrow("5 MB");
    } finally {
      cleanTmpFile(bigFile);
    }
  });

  it("uses only 2 API calls (create + send) when /send returns status=uploaded", async () => {
    // This is the single-part upload path used by the Notion API in practice:
    // /send completes the upload atomically and returns status="uploaded".
    // /complete is only needed for multi-part (large) uploads.
    const filePath = makeTmpFile("test.pdf", "PDF content");
    const uploadId = "file-upload-abc123";

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/file_uploads")) {
        return {
          ok: true,
          json: async () => ({
            id: uploadId,
            created_time: "2026-01-01T00:00:00.000Z",
            expiry_time: "2026-01-02T00:00:00.000Z",
          }),
        };
      }
      if (url.endsWith("/send")) {
        // /send returns uploaded status directly (single-part flow)
        return {
          ok: true,
          json: async () => ({
            id: uploadId,
            status: "uploaded",
            created_time: "2026-01-01T00:00:00.000Z",
            expiry_time: "2026-01-02T00:00:00.000Z",
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({ message: "Should not be called" }) };
    });

    try {
      const result = await uploadFileToNotion(filePath, {
        token: "ntn_test",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(result.id).toBe(uploadId);
      expect(result.status).toBe("uploaded");
      expect(result.filename).toBe("test.pdf");

      // Only 2 calls: create → send (no /complete for single-part)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(urls[0]).toContain("/file_uploads");
      expect(urls[1]).toContain("/send");
    } finally {
      cleanTmpFile(filePath);
    }
  });

  it("calls /complete when /send response does not include status=uploaded", async () => {
    // Simulates a future multi-part or pending scenario where /complete is needed
    const filePath = makeTmpFile("multipart.pdf", "PDF content");
    const uploadId = "file-upload-xyz789";

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/file_uploads")) {
        return {
          ok: true,
          json: async () => ({ id: uploadId }),
        };
      }
      if (url.endsWith("/send")) {
        // /send returns without status (pending scenario)
        return { ok: true, json: async () => ({ id: uploadId }) };
      }
      if (url.endsWith("/complete")) {
        return {
          ok: true,
          json: async () => ({
            id: uploadId,
            status: "uploaded",
            created_time: "2026-01-01T00:00:00.000Z",
            expiry_time: "2026-01-02T00:00:00.000Z",
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
    });

    try {
      const result = await uploadFileToNotion(filePath, {
        token: "ntn_test",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(result.id).toBe(uploadId);
      expect(result.status).toBe("uploaded");

      // 3 calls: create → send → complete
      expect(mockFetch).toHaveBeenCalledTimes(3);
      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(urls[2]).toContain("/complete");
    } finally {
      cleanTmpFile(filePath);
    }
  });

  it("throws a descriptive error when the create session API call fails", async () => {
    const filePath = makeTmpFile("fail.pdf", "content");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    });

    try {
      await expect(
        uploadFileToNotion(filePath, {
          token: "bad_token",
          fetchImpl: mockFetch as unknown as typeof fetch,
        }),
      ).rejects.toThrow("Unauthorized");
    } finally {
      cleanTmpFile(filePath);
    }
  });
});
