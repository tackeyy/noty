import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { createProgram, checkIsMain } from "../index.js";
import type { NotionClientInterface } from "../../lib/notion-client-interface.js";
import { symlinkSync, unlinkSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- Mock NotyClient factory ---

function createMockClient(): NotionClientInterface {
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
    uploadFile: vi.fn().mockResolvedValue({
      id: "file-upload-id-1",
      status: "uploaded",
      createdTime: "2026-01-01T00:00:00.000Z",
      expiryTime: "2026-01-02T00:00:00.000Z",
      filename: "test.pdf",
    }),
    attachFileToPage: vi.fn().mockResolvedValue({
      id: "page-id-1",
      title: "Test Page",
      url: "https://notion.so/Test-Page",
      createdTime: "2026-01-01T00:00:00.000Z",
      lastEditedTime: "2026-01-07T00:00:00.000Z",
      properties: {},
    }),
  } as unknown as NotionClientInterface;
}

// --- Helpers ---

async function runCmd(client: NotionClientInterface, args: string[]): Promise<void> {
  const program = createProgram(client);
  // exitOverride prevents commander from calling process.exit on errors
  program.exitOverride();
  await program.parseAsync(["node", "noty", ...args]);
}

// --- Tests ---

describe("CLI commands", () => {
  let mockClient: NotionClientInterface;
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

    it("--all を search() の all オプションとして渡す", async () => {
      await runCmd(mockClient, ["search", "hello", "--all"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "hello",
        expect.objectContaining({ all: true }),
      );
    });

    it("query 省略 + --all で空クエリの全件列挙になる", async () => {
      await runCmd(mockClient, ["search", "--all"]);

      expect(mockClient.search).toHaveBeenCalledWith(
        "",
        expect.objectContaining({ all: true }),
      );
    });

    it("plain 出力に parent 情報の列を含む", async () => {
      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: "page-id-1",
          title: "Test Page",
          type: "page",
          url: "https://notion.so/Test-Page",
          lastEditedTime: "2026-01-02T00:00:00.000Z",
          parentType: "page_id",
          parentId: "parent-1",
        },
      ]);
      await runCmd(mockClient, ["search", "hello", "--plain"]);

      const lines = consoleLogSpy.mock.calls.map((c) => c.join(" "));
      expect(
        lines.some((l) => l.includes("page_id") && l.includes("parent-1")),
      ).toBe(true);
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

  // =========================================================================
  // --content-file option (Issue #51)
  // =========================================================================

  describe("pages create --content-file", () => {
    const tempDir = join(tmpdir(), `noty-content-file-test-${Date.now()}`);
    const contentFile = join(tempDir, "test-content.md");

    beforeEach(() => {
      mkdirSync(tempDir, { recursive: true });
      writeFileSync(contentFile, "# File Content\n\nFrom file.");
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("--content-file でファイルからコンテンツを読み取って createPage に渡す", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
        "--content-file", contentFile,
      ]);

      expect(mockClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({ content: "# File Content\n\nFrom file." }),
      );
    });

    it("--content と --content-file の同時指定はエラーになる", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
        "--content", "inline",
        "--content-file", contentFile,
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: --content and --content-file cannot be used together",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockClient.createPage).not.toHaveBeenCalled();
    });

    it("存在しないファイルを指定するとエラーになる", async () => {
      await runCmd(mockClient, [
        "pages", "create",
        "--parent", "parent-id",
        "--title", "My Page",
        "--content-file", "/nonexistent/file.md",
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("--content-file"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockClient.createPage).not.toHaveBeenCalled();
    });
  });

  describe("pages update --content-file", () => {
    const tempDir = join(tmpdir(), `noty-update-file-test-${Date.now()}`);
    const contentFile = join(tempDir, "update-content.md");

    beforeEach(() => {
      mkdirSync(tempDir, { recursive: true });
      writeFileSync(contentFile, "Updated from file.");
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("--content-file でファイルからコンテンツを読み取って updatePage に渡す", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--content-file", contentFile,
      ]);

      expect(mockClient.updatePage).toHaveBeenCalledWith(
        "page-id-1",
        expect.objectContaining({ content: "Updated from file." }),
      );
    });

    it("--content と --content-file の同時指定はエラーになる", async () => {
      await runCmd(mockClient, [
        "pages", "update", "page-id-1",
        "--content", "inline",
        "--content-file", contentFile,
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: --content and --content-file cannot be used together",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockClient.updatePage).not.toHaveBeenCalled();
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

    it("exits with code 1 when no auth is configured", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      const savedConfigDir = process.env.NOTY_CONFIG_DIR;
      delete process.env.NOTION_TOKEN;
      process.env.NOTY_CONFIG_DIR = join(tmpdir(), `noty-no-auth-${Date.now()}`);

      // Use a program without injected client so createClientFromEnv() is called
      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(["node", "noty", "auth", "test"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No authentication configured"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      if (savedToken !== undefined) process.env.NOTION_TOKEN = savedToken;
      if (savedConfigDir !== undefined) process.env.NOTY_CONFIG_DIR = savedConfigDir;
      else delete process.env.NOTY_CONFIG_DIR;
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

  describe("auth status", () => {
    const testConfigDir = join(tmpdir(), `noty-auth-status-${Date.now()}`);

    beforeEach(() => {
      mkdirSync(testConfigDir, { recursive: true });
      process.env.NOTY_CONFIG_DIR = testConfigDir;
    });

    afterEach(() => {
      rmSync(testConfigDir, { recursive: true, force: true });
      delete process.env.NOTY_CONFIG_DIR;
    });

    it("shows 'not authenticated' when no auth configured and no NOTION_TOKEN", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      delete process.env.NOTION_TOKEN;
      await runCmd(mockClient, ["auth", "status"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Not authenticated"),
      );
      if (savedToken !== undefined) process.env.NOTION_TOKEN = savedToken;
    });

    it("shows integration type when NOTION_TOKEN is set", async () => {
      process.env.NOTION_TOKEN = "secret_integration_token";
      await runCmd(mockClient, ["auth", "status"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Integration Token"),
      );
      delete process.env.NOTION_TOKEN;
    });

    it("shows oauth info when oauth config exists", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      delete process.env.NOTION_TOKEN;
      writeFileSync(
        join(testConfigDir, "config.json"),
        JSON.stringify({
          auth: { type: "oauth", access_token: "tok", bot_id: "b1", workspace_id: "ws1", workspace_name: "My WS" },
        }),
      );
      await runCmd(mockClient, ["auth", "status"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("OAuth"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("My WS"));
      if (savedToken !== undefined) process.env.NOTION_TOKEN = savedToken;
    });

    it("outputs json with --json flag when oauth configured", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      delete process.env.NOTION_TOKEN;
      writeFileSync(
        join(testConfigDir, "config.json"),
        JSON.stringify({
          auth: { type: "oauth", access_token: "tok", bot_id: "b1", workspace_id: "ws1", workspace_name: "My WS" },
        }),
      );
      await runCmd(mockClient, ["--json", "auth", "status"]);
      const jsonArg = consoleLogSpy.mock.calls.find((c) => typeof c[0] === "string" && (c[0] as string).includes('"type"'));
      expect(jsonArg).toBeDefined();
      const parsed = JSON.parse(jsonArg![0] as string);
      expect(parsed.type).toBe("oauth");
      expect(parsed.workspace).toBe("My WS");
      if (savedToken !== undefined) process.env.NOTION_TOKEN = savedToken;
    });

    it("shows NOTION_TOKEN_V2 env usage when NOTION_TOKEN_V2 is set", async () => {
      const savedToken = process.env.NOTION_TOKEN;
      const savedV2 = process.env.NOTION_TOKEN_V2;
      delete process.env.NOTION_TOKEN;
      process.env.NOTION_TOKEN_V2 = "env-v2-token-value";
      await runCmd(mockClient, ["auth", "status"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("NOTION_TOKEN_V2"));
      if (savedToken !== undefined) process.env.NOTION_TOKEN = savedToken;
      if (savedV2 !== undefined) process.env.NOTION_TOKEN_V2 = savedV2;
      else delete process.env.NOTION_TOKEN_V2;
    });
  });

  describe("auth logout", () => {
    const testConfigDir = join(tmpdir(), `noty-auth-logout-${Date.now()}`);

    beforeEach(() => {
      mkdirSync(testConfigDir, { recursive: true });
      process.env.NOTY_CONFIG_DIR = testConfigDir;
      delete process.env.NOTION_TOKEN;
    });

    afterEach(() => {
      rmSync(testConfigDir, { recursive: true, force: true });
      delete process.env.NOTY_CONFIG_DIR;
    });

    it("removes oauth token and prints confirmation", async () => {
      writeFileSync(
        join(testConfigDir, "config.json"),
        JSON.stringify({
          auth: { type: "oauth", access_token: "tok", bot_id: "b", workspace_id: "w", workspace_name: "WS" },
        }),
      );
      await runCmd(mockClient, ["auth", "logout"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });

    it("prints appropriate message when using NOTION_TOKEN", async () => {
      process.env.NOTION_TOKEN = "secret_int";
      await runCmd(mockClient, ["auth", "logout"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("NOTION_TOKEN"));
      delete process.env.NOTION_TOKEN;
    });

    it("prints 'Not authenticated' when no auth configured", async () => {
      await runCmd(mockClient, ["auth", "logout"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Not authenticated"));
    });
  });

  describe("auth set-cookie", () => {
    const testConfigDir = join(tmpdir(), `noty-auth-set-cookie-${Date.now()}`);

    beforeEach(() => {
      mkdirSync(testConfigDir, { recursive: true });
      process.env.NOTY_CONFIG_DIR = testConfigDir;
      delete process.env.NOTION_TOKEN;
    });

    afterEach(() => {
      rmSync(testConfigDir, { recursive: true, force: true });
      delete process.env.NOTY_CONFIG_DIR;
    });

    it("saves token_v2 to config and prints confirmation", async () => {
      await runCmd(mockClient, ["auth", "set-cookie", "v2-token-value-abc"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("認証を設定しました"));
    });

    it("exits with code 1 when no token_v2 argument is given", async () => {
      await runCmd(mockClient, ["auth", "set-cookie"]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("auth status token_v2", () => {
    const testConfigDir = join(tmpdir(), `noty-auth-status-v2-${Date.now()}`);

    beforeEach(() => {
      mkdirSync(testConfigDir, { recursive: true });
      process.env.NOTY_CONFIG_DIR = testConfigDir;
      delete process.env.NOTION_TOKEN;
    });

    afterEach(() => {
      rmSync(testConfigDir, { recursive: true, force: true });
      delete process.env.NOTY_CONFIG_DIR;
    });

    it("shows 'cookie (token_v2)' when token_v2 config exists", async () => {
      writeFileSync(
        join(testConfigDir, "config.json"),
        JSON.stringify({ auth: { type: "token_v2", token_v2: "v2tok" } }),
      );
      await runCmd(mockClient, ["auth", "status"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("cookie (token_v2)"));
    });
  });

  describe("auth logout token_v2", () => {
    const testConfigDir = join(tmpdir(), `noty-auth-logout-v2-${Date.now()}`);

    beforeEach(() => {
      mkdirSync(testConfigDir, { recursive: true });
      process.env.NOTY_CONFIG_DIR = testConfigDir;
      delete process.env.NOTION_TOKEN;
    });

    afterEach(() => {
      rmSync(testConfigDir, { recursive: true, force: true });
      delete process.env.NOTY_CONFIG_DIR;
    });

    it("removes token_v2 config and prints confirmation", async () => {
      writeFileSync(
        join(testConfigDir, "config.json"),
        JSON.stringify({ auth: { type: "token_v2", token_v2: "v2tok" } }),
      );
      await runCmd(mockClient, ["auth", "logout"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });
  });

  describe("auth login errors", () => {
    it("exits with code 1 when NOTION_OAUTH_CLIENT_ID is missing", async () => {
      const savedCid = process.env.NOTION_OAUTH_CLIENT_ID;
      const savedCs = process.env.NOTION_OAUTH_CLIENT_SECRET;
      delete process.env.NOTION_OAUTH_CLIENT_ID;
      process.env.NOTION_OAUTH_CLIENT_SECRET = "secret";

      await runCmd(mockClient, ["auth", "login"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("NOTION_OAUTH_CLIENT_ID"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      if (savedCid !== undefined) process.env.NOTION_OAUTH_CLIENT_ID = savedCid;
      if (savedCs !== undefined) process.env.NOTION_OAUTH_CLIENT_SECRET = savedCs;
      else delete process.env.NOTION_OAUTH_CLIENT_SECRET;
    });

    it("exits with code 1 when NOTION_OAUTH_CLIENT_SECRET is missing", async () => {
      const savedCid = process.env.NOTION_OAUTH_CLIENT_ID;
      const savedCs = process.env.NOTION_OAUTH_CLIENT_SECRET;
      process.env.NOTION_OAUTH_CLIENT_ID = "client-id";
      delete process.env.NOTION_OAUTH_CLIENT_SECRET;

      await runCmd(mockClient, ["auth", "login"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("NOTION_OAUTH_CLIENT_SECRET"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      if (savedCid !== undefined) process.env.NOTION_OAUTH_CLIENT_ID = savedCid;
      else delete process.env.NOTION_OAUTH_CLIENT_ID;
      if (savedCs !== undefined) process.env.NOTION_OAUTH_CLIENT_SECRET = savedCs;
    });
  });

  // =========================================================================
  // files upload
  // =========================================================================
  describe("files upload", () => {
    it("calls uploadFile() and prints ID, status, filename in human mode", async () => {
      await runCmd(mockClient, ["files", "upload", "/tmp/test.pdf"]);
      expect(mockClient.uploadFile).toHaveBeenCalledWith("/tmp/test.pdf");
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("file-upload-id-1"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("uploaded"));
    });

    it("outputs JSON when --json flag is given", async () => {
      await runCmd(mockClient, ["--json", "files", "upload", "/tmp/test.pdf"]);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe("file-upload-id-1");
      expect(parsed.status).toBe("uploaded");
    });

    it("outputs TSV when --plain flag is given", async () => {
      await runCmd(mockClient, ["--plain", "files", "upload", "/tmp/test.pdf"]);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain("file-upload-id-1");
      expect(output).toContain("\t");
    });

    it("prints error and exits when uploadFile() throws", async () => {
      (mockClient.uploadFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("File not found: /bad/path.pdf"),
      );
      await runCmd(mockClient, ["files", "upload", "/bad/path.pdf"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("File not found"));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // pages attach-file
  // =========================================================================
  describe("pages attach-file", () => {
    it("calls attachFileToPage() and prints page info", async () => {
      await runCmd(mockClient, ["pages", "attach-file", "page-id-1", "/tmp/test.pdf"]);
      expect(mockClient.attachFileToPage).toHaveBeenCalledWith(
        "page-id-1",
        "/tmp/test.pdf",
        { caption: undefined },
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Test Page"));
    });

    it("passes caption to attachFileToPage when --caption is given", async () => {
      await runCmd(mockClient, [
        "pages", "attach-file", "page-id-1", "/tmp/test.pdf", "--caption", "My File",
      ]);
      expect(mockClient.attachFileToPage).toHaveBeenCalledWith(
        "page-id-1",
        "/tmp/test.pdf",
        { caption: "My File" },
      );
    });

    it("outputs JSON when --json flag is given", async () => {
      await runCmd(mockClient, ["--json", "pages", "attach-file", "page-id-1", "/tmp/test.pdf"]);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe("page-id-1");
    });

    it("prints error and exits when attachFileToPage() throws", async () => {
      (mockClient.attachFileToPage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Upload failed"),
      );
      await runCmd(mockClient, ["pages", "attach-file", "page-id-1", "/tmp/test.pdf"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Upload failed"));
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
