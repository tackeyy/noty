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

    it("passes sort option", async () => {
      await client.search("test", {
        sort: { direction: "descending", timestamp: "last_edited_time" },
      });
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          sort: { direction: "descending", timestamp: "last_edited_time" },
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

    it("creates a page with database_id parent", async () => {
      await client.createPage({
        parentId: "db-parent-id",
        parentType: "database_id",
        title: "DB Page",
      });
      const callArgs = mockClient.pages.create.mock.calls[0][0];
      expect(callArgs.parent).toEqual({ database_id: "db-parent-id" });
    });

    it("defaults to page_id parent when parentType is not specified", async () => {
      await client.createPage({
        parentId: "page-parent-id",
        title: "Page Child",
      });
      const callArgs = mockClient.pages.create.mock.calls[0][0];
      expect(callArgs.parent).toEqual({ page_id: "page-parent-id" });
    });
  });

  describe("updatePage", () => {
    it("updates properties", async () => {
      await client.updatePage("page-id-1", {
        properties: { Name: "Updated" },
      });
      expect(mockClient.pages.update).toHaveBeenCalled();
    });

    it("replaces content by default", async () => {
      await client.updatePage("page-id-1", {
        content: "New content",
      });
      expect(mockClient.blocks.delete).toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });

    it("replaces content when mode is replace", async () => {
      await client.updatePage("page-id-1", {
        content: "New content",
        mode: "replace",
      });
      expect(mockClient.blocks.delete).toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });

    it("appends content without deleting existing blocks when mode is append", async () => {
      await client.updatePage("page-id-1", {
        content: "Appended content",
        mode: "append",
      });
      expect(mockClient.blocks.delete).not.toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });
  });

  describe("updatePage - pagination and chunking", () => {
    it("paginates block deletion when page has more than 100 blocks", async () => {
      const page1Blocks = Array.from({ length: 100 }, (_, i) => ({
        id: `block-${i}`,
        type: "paragraph",
        has_children: false,
        paragraph: { rich_text: [{ plain_text: `Block ${i}` }] },
      }));
      const page2Blocks = Array.from({ length: 50 }, (_, i) => ({
        id: `block-${100 + i}`,
        type: "paragraph",
        has_children: false,
        paragraph: { rich_text: [{ plain_text: `Block ${100 + i}` }] },
      }));

      mockClient.blocks.children.list
        .mockResolvedValueOnce({
          results: page1Blocks,
          has_more: true,
          next_cursor: "cursor-page-2",
        })
        .mockResolvedValueOnce({
          results: page2Blocks,
          has_more: false,
          next_cursor: null,
        });

      await client.updatePage("page-id-1", { content: "New content" });

      // Should have called list twice for pagination
      expect(mockClient.blocks.children.list).toHaveBeenCalledTimes(2);
      // Should have deleted all 150 blocks
      expect(mockClient.blocks.delete).toHaveBeenCalledTimes(150);
    });

    it("chunks block appending when content generates more than 100 blocks", async () => {
      // Reset list to return empty (no existing blocks to delete)
      mockClient.blocks.children.list.mockResolvedValueOnce({
        results: [],
        has_more: false,
        next_cursor: null,
      });

      // Generate content with many blocks (each line becomes a paragraph block)
      const lines = Array.from({ length: 150 }, (_, i) => `Line ${i}`);
      const content = lines.join("\n\n");

      await client.updatePage("page-id-1", { content });

      // Should have called append at least twice (150 blocks / 100 per chunk)
      expect(mockClient.blocks.children.append.mock.calls.length).toBeGreaterThanOrEqual(2);
      // First chunk should have at most 100 children
      expect(mockClient.blocks.children.append.mock.calls[0][0].children.length).toBeLessThanOrEqual(100);
    });
  });

  describe("clearPage", () => {
    it("deletes all blocks from a page", async () => {
      const result = await client.clearPage("page-id-1");
      expect(mockClient.blocks.children.list).toHaveBeenCalled();
      expect(mockClient.blocks.delete).toHaveBeenCalledWith({ block_id: "block-1" });
      expect(result.id).toBe("page-id-1");
    });

    it("paginates when clearing a page with more than 100 blocks", async () => {
      const page1Blocks = Array.from({ length: 100 }, (_, i) => ({
        id: `block-${i}`,
        type: "paragraph",
      }));
      const page2Blocks = Array.from({ length: 30 }, (_, i) => ({
        id: `block-${100 + i}`,
        type: "paragraph",
      }));

      mockClient.blocks.children.list
        .mockResolvedValueOnce({
          results: page1Blocks,
          has_more: true,
          next_cursor: "cursor-2",
        })
        .mockResolvedValueOnce({
          results: page2Blocks,
          has_more: false,
          next_cursor: null,
        });

      await client.clearPage("page-id-1");

      expect(mockClient.blocks.children.list).toHaveBeenCalledTimes(2);
      expect(mockClient.blocks.delete).toHaveBeenCalledTimes(130);
    });
  });

  describe("getDatabase", () => {
    it("returns database metadata", async () => {
      const result = await client.getDatabase("db-id-1");
      expect(result.id).toBe("db-id-1");
      expect(result.title).toBe("Test Database");
      expect(result.properties).toHaveProperty("Name");
      expect(result.properties).toHaveProperty("Status");
      expect(mockClient.databases.retrieve).toHaveBeenCalledWith({
        database_id: "db-id-1",
      });
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
