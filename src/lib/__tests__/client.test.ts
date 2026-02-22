import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockNotionClient } from "../../__tests__/helpers/mock-notion.js";

// Mock @notionhq/client
const mockClient = createMockNotionClient();
vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => mockClient),
}));

import { NotyClient } from "../client.js";

describe("NotyClient", () => {
  let client: NotyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new NotyClient({ token: "test-token" });
  });

  it("throws if no token provided", () => {
    expect(() => new NotyClient({ token: "" })).toThrow(
      "Notion token is required",
    );
  });

  describe("search", () => {
    it("returns search results", async () => {
      const results = await client.search("test");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("page-id-1");
      expect(results[0].title).toBe("Test Page");
      expect(results[0].type).toBe("page");
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: "test", page_size: 10 }),
      );
    });

    it("passes filter and limit options", async () => {
      await client.search("test", { filter: "database", limit: 5 });
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          page_size: 5,
          filter: { property: "object", value: "database" },
        }),
      );
    });
  });

  describe("getPage", () => {
    it("returns markdown content", async () => {
      const content = await client.getPage("page-id-1");
      expect(content).toBe("Hello World");
      expect(mockClient.blocks.children.list).toHaveBeenCalled();
    });
  });

  describe("getPageMetadata", () => {
    it("returns page metadata", async () => {
      const result = await client.getPageMetadata("page-id-1");
      expect(result.id).toBe("page-id-1");
      expect(result.title).toBe("Test Page");
    });
  });

  describe("createPage", () => {
    it("creates a page with title", async () => {
      const result = await client.createPage({
        parentId: "parent-id",
        title: "New Page",
      });
      expect(result.id).toBe("new-page-id");
      expect(mockClient.pages.create).toHaveBeenCalled();
    });

    it("creates a page with content", async () => {
      await client.createPage({
        parentId: "parent-id",
        title: "Page",
        content: "# Hello\n\nWorld",
      });
      const callArgs = mockClient.pages.create.mock.calls[0][0];
      expect(callArgs.children).toBeDefined();
      expect(callArgs.children.length).toBeGreaterThan(0);
    });
  });

  describe("updatePage", () => {
    it("updates properties", async () => {
      await client.updatePage("page-id-1", {
        properties: { Name: "Updated" },
      });
      expect(mockClient.pages.update).toHaveBeenCalled();
    });

    it("replaces content", async () => {
      await client.updatePage("page-id-1", {
        content: "New content",
      });
      expect(mockClient.blocks.delete).toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });
  });

  describe("queryDatabase", () => {
    it("returns query results", async () => {
      const result = await client.queryDatabase("db-id");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe("Row 1");
      expect(result.hasMore).toBe(false);
    });
  });

  describe("listComments", () => {
    it("returns comments", async () => {
      const comments = await client.listComments("page-id-1");
      expect(comments).toHaveLength(1);
      expect(comments[0].richText).toBe("Test comment");
    });
  });

  describe("createComment", () => {
    it("creates a comment", async () => {
      const comment = await client.createComment("page-id-1", "Hello");
      expect(comment.id).toBe("comment-2");
      expect(comment.richText).toBe("New comment");
    });
  });

  describe("listUsers", () => {
    it("returns users", async () => {
      const users = await client.listUsers();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("Test User");
      expect(users[0].type).toBe("person");
      expect(users[1].type).toBe("bot");
    });
  });

  describe("authTest", () => {
    it("returns auth info", async () => {
      const info = await client.authTest();
      expect(info.botId).toBe("bot-1");
      expect(info.workspaceName).toBe("Test Workspace");
    });
  });
});
