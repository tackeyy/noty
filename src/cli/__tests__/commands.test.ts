import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { createProgram, checkIsMain } from "../index.js";
import type { NotyClient } from "../../lib/client.js";
import { symlinkSync, unlinkSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- Mock NotyClient factory ---

function createMockClient(): NotyClient {
  return {
    authTest: vi.fn().mockResolvedValue({
      botId: "bot-id-1",
      workspaceName: "Test Workspace",
      workspaceId: "ws-id-1",
    }),
    search: vi.fn().mockResolvedValue([
      {
        id: "page-id-1",
        title: "Test Page",
        type: "page",
        url: "https://notion.so/Test-Page",
        lastEditedTime: "2026-01-02T00:00:00.000Z",
      },
    ]),
    getPage: vi.fn().mockResolvedValue("# Hello World\n\nContent here."),
    getPageMetadata: vi.fn().mockResolvedValue({
      id: "page-id-1",
      title: "Test Page",
      url: "https://notion.so/Test-Page",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-02T00:00:00.000Z",
      properties: {},
    }),
    createPage: vi.fn().mockResolvedValue({
      id: "new-page-id",
      title: "New Page",
      url: "https://notion.so/New-Page",
      createdTime: "2026-01-03T00:00:00.000Z",
      lastEditedTime: "2026-01-03T00:00:00.000Z",
      properties: {},
    }),
    updatePage: vi.fn().mockResolvedValue({
      id: "page-id-1",
      title: "Updated Page",
      url: "https://notion.so/Page-1",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-04T00:00:00.000Z",
      properties: {},
    }),
    clearPage: vi.fn().mockResolvedValue({
      id: "page-id-1",
      title: "Cleared Page",
      url: "https://notion.so/Page-1",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-05T00:00:00.000Z",
      properties: {},
    }),
    archivePage: vi.fn().mockResolvedValue({
      id: "page-id-1",
      title: "Archived Page",
      url: "https://notion.so/Page-1",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-06T00:00:00.000Z",
      properties: {},
    }),
    getDatabase: vi.fn().mockResolvedValue({
      id: "db-id-1",
      title: "Test Database",
      url: "https://notion.so/DB-1",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-02T00:00:00.000Z",
      properties: {
        Name: { id: "title", name: "Name", type: "title", title: {} },
      },
    }),
    queryDatabase: vi.fn().mockResolvedValue({
      results: [
        {
          id: "row-1",
          title: "Row 1",
          url: "https://notion.so/Row-1",
          createdTime: "2026-01-01T00:00:00.000Z",
          lastEditedTime: "2026-01-02T00:00:00.000Z",
          properties: {},
        },
      ],
      hasMore: false,
      nextCursor: null,
    }),
    listComments: vi.fn().mockResolvedValue([
      {
        id: "comment-1",
        createdTime: "2026-01-01T00:00:00.000Z",
        lastEditedTime: "2026-01-01T00:00:00.000Z",
        createdBy: { id: "user-1", name: "Test User" },
        richText: "Test comment",
      },
    ]),
    createComment: vi.fn().mockResolvedValue({
      id: "comment-2",
      createdTime: "2026-01-02T00:00:00.000Z",
      lastEditedTime: "2026-01-02T00:00:00.000Z",
      createdBy: { id: "bot-1" },
      richText: "New comment",
    }),
    listUsers: vi.fn().mockResolvedValue([
      {
        id: "user-1",
        name: "Test User",
        type: "person",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.png",
      },
      {
        id: "bot-1",
        name: "Bot",
        type: "bot",
        avatarUrl: null,
      },
    ]),
  } as unknown as NotyClient;
}

// --- Helpers ---

async function runCmd(client: NotyClient, args: string[]): Promise<void> {
  const program = createProgram(client);
  // exitOverride prevents commander from calling process.exit on errors
  program.exitOverride();
  await program.parseAsync(["node", "noty", ...args]);
}

// --- Tests ---

describe("CLI commands", () => {
  let mockClient: NotyClient;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: MockInstance;

  beforeEach(() => {
    mockClient = createMockClient();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Priority 1 — Issue #27: pages create --parent-type
  // =========================================================================

  describe("pages create --parent-type (Issue #27)", () => {
    it("passes parentType: database_id to createPage when --parent-type database_id is given", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "db-parent-id",
        "--parent-type", "database_id",
        "--title", "New Entry",
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "db-parent-id",
          parentType: "database_id",
          title: "New Entry",
        }),
      );
    });

    it("passes parentType: page_id to createPage when --parent-type page_id is given", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "page-parent-id",
        "--parent-type", "page_id",
        "--title", "Sub Page",
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "page-parent-id",
          parentType: "page_id",
        }),
      );
    });

    it("does not include parentType in createPage call when --parent-type is omitted", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "page-parent-id",
        "--title", "My Page",
      ]);

      const callArg = (mockClient.createPage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.parentType).toBeUndefined();
    });
  });

  // =========================================================================
  // Priority 2 — Happy paths
  // =========================================================================

  describe("auth test", () => {
    it("calls authTest() and prints bot info", async () => {
      await runCmd(mockClient, ["auth", "test"]);

      expect(mockClient.authTest).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith("Bot ID: bot-id-1");
      expect(consoleLogSpy).toHaveBeenCalledWith("Workspace: Test Workspace");
    });
  });

  describe("search", () => {
    it("calls search() with the given query", async () => {
      await runCmd(mockClient, ["search", "hello"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ limit: 10 }),
      );
    });

    it("passes --filter option to search()", async () => {
      await runCmd(mockClient, ["search", "hello", "--filter", "page"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ filter: "page" }),
      );
    });

    it("passes --limit option to search()", async () => {
      await runCmd(mockClient, ["search", "hello", "--limit", "5"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ limit: 5 }),
      );
    });

    it("passes --sort option to search()", async () => {
      await runCmd(mockClient, ["search", "hello", "--sort", "descending"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({
          sort: { direction: "descending", timestamp: "last_edited_time" },
        }),
      );
    });

    it("does not pass sort when --sort is not provided", async () => {
      await runCmd(mockClient, ["search", "hello"]);

      const callArg = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArg.sort).toBeUndefined();
    });
  });

  describe("pages get", () => {
    it("calls getPage() and prints content", async () => {
      await runCmd(mockClient, ["pages", "get", "page-id-1"]);

      expect(mockClient.getPage).toHaveBeenCalledWith("page-id-1");
      expect(consoleLogSpy).toHaveBeenCalledWith("# Hello World\n\nContent here.");
    });

    it("calls getPageMetadata() and getPage() when --json flag is set", async () => {
      await runCmd(mockClient, ["--json", "pages", "get", "page-id-1"]);

      expect(mockClient.getPageMetadata).toHaveBeenCalledWith("page-id-1");
      expect(mockClient.getPage).toHaveBeenCalledWith("page-id-1");
    });

    it("does not call getPageMetadata() in non-json mode", async () => {
      await runCmd(mockClient, ["pages", "get", "page-id-1"]);

      expect(mockClient.getPageMetadata).not.toHaveBeenCalled();
    });
  });

  describe("pages create", () => {
    it("calls createPage() with parentId and title", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "parent-id",
          title: "My Page",
        }),
      );
    });

    it("passes --content option to createPage()", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
        "--content", "Hello world",
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Hello world" }),
      );
    });

    it("passes --properties option as parsed JSON to createPage()", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--properties", '{"Status": "Active"}',
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: { Status: "Active" },
        }),
      );
    });
  });

  describe("pages update", () => {
    it("calls updatePage() with id and content", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--content", "Updated content",
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({ content: "Updated content" }),
      );
    });

    it("passes mode: append when --append flag is set", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--content", "More content",
        "--append",
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({ mode: "append" }),
      );
    });

    it("defaults to mode: replace when --append is not set", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--content", "New content",
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({ mode: "replace" }),
      );
    });

    it("passes --title as properties when --properties is not given", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--title", "New Title",
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({
          properties: { Name: "New Title" },
        }),
      );
    });

    it("passes --properties as parsed JSON, ignoring --title for properties", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--properties", '{"Status": "Done"}',
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({
          properties: { Status: "Done" },
        }),
      );
    });
  });

  describe("pages clear", () => {
    it("calls clearPage() with the given id", async () => {
      await runCmd(mockClient, ["pages", "clear", "page-id-1"]);

      expect(mockClient.clearPage).toHaveBeenCalledWith("page-id-1");
    });
  });

  describe("pages archive", () => {
    it("calls archivePage() with the given id", async () => {
      await runCmd(mockClient, ["pages", "archive", "page-id-1"]);

      expect(mockClient.archivePage).toHaveBeenCalledWith("page-id-1");
    });
  });

  describe("databases get", () => {
    it("calls getDatabase() with the given id", async () => {
      await runCmd(mockClient, ["databases", "get", "db-id-1"]);

      expect(mockClient.getDatabase).toHaveBeenCalledWith("db-id-1");
    });
  });

  describe("databases query", () => {
    it("calls queryDatabase() with the given id", async () => {
      await runCmd(mockClient, ["databases", "query", "db-id-1"]);

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        "db-id-1",
        expect.objectContaining({ pageSize: 100 }),
      );
    });

    it("passes --filter as parsed JSON", async () => {
      const filter = '{"property":"Status","select":{"equals":"Active"}}';
      await runCmd(mockClient, ["databases", "query", "db-id-1", "--filter", filter]);

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        "db-id-1",
        expect.objectContaining({
          filter: { property: "Status", select: { equals: "Active" } },
        }),
      );
    });

    it("passes --sorts as parsed JSON", async () => {
      const sorts = '[{"property":"Name","direction":"ascending"}]';
      await runCmd(mockClient, ["databases", "query", "db-id-1", "--sorts", sorts]);

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        "db-id-1",
        expect.objectContaining({
          sorts: [{ property: "Name", direction: "ascending" }],
        }),
      );
    });

    it("passes --limit as parsed integer", async () => {
      await runCmd(mockClient, ["databases", "query", "db-id-1", "--limit", "20"]);

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        "db-id-1",
        expect.objectContaining({ pageSize: 20 }),
      );
    });
  });

  describe("comments list", () => {
    it("calls listComments() with the given page id", async () => {
      await runCmd(mockClient, ["comments", "list", "page-id-1"]);

      expect(mockClient.listComments).toHaveBeenCalledWith("page-id-1");
    });
  });

  describe("comments add", () => {
    it("calls createComment() with page id and body text", async () => {
      await runCmd(mockClient, [
        "comments", "add", "page-id-1",
        "--body", "Hello there",
      ]);

      expect(mockClient.createComment).toHaveBeenCalledWith("page-id-1", "Hello there");
    });
  });

  describe("users list", () => {
    it("calls listUsers() and prints user names", async () => {
      await runCmd(mockClient, ["users", "list"]);

      expect(mockClient.listUsers).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith("Test User");
    });
  });

  // =========================================================================
  // Priority 3 — Error paths
  // =========================================================================

  describe("error paths", () => {
    it("exits with code 1 and prints error when pages create has no --title or --properties", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: --title or --properties is required",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 when NOTION_TOKEN is not set", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      delete process.env.NOTION_TOKEN;

      // Use a program without injected client so createClientFromEnv() is called
      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(["node", "noty", "auth", "test"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: NOTION_TOKEN environment variable is not set",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      if (savedToken !== undefined) {
        process.env.NOTION_TOKEN = savedToken;
      }
    });

    it("--parent-type に不正な値を渡すと exit(1) する", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
        "--parent-type", "invalid_type",
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: --parent-type must be "page_id" or "database_id"',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockClient.createPage).not.toHaveBeenCalled();
    });

    it("exits with code 1 and prints error message when a client method throws", async () => {
      (mockClient.authTest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Unauthorized"),
      );

      await runCmd(mockClient, ["auth", "test"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Unauthorized");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});

describe("checkIsMain", () => {
  const tempDir = join(tmpdir(), `noty-test-${Date.now()}`);
  const realFile = join(tempDir, "index.js");
  const symlinkFile = join(tempDir, "noty");

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(realFile, "// stub");
    try { unlinkSync(symlinkFile); } catch { /* ignore */ }
    symlinkSync(realFile, symlinkFile);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("index.js で終わるパスは true を返す", () => {
    expect(checkIsMain(realFile)).toBe(true);
  });

  it("symlink 経由でも解決先が index.js なら true を返す", () => {
    expect(checkIsMain(symlinkFile)).toBe(true);
  });

  it("index.js/index.ts に解決されないパスは false を返す", () => {
    const otherFile = join(tempDir, "other.js");
    writeFileSync(otherFile, "// stub");
    expect(checkIsMain(otherFile)).toBe(false);
  });

  it("存在しないパスは false を返す（realpathSync がフォールバック）", () => {
    expect(checkIsMain("/nonexistent/path/noty")).toBe(false);
  });
});
