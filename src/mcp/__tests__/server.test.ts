import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockNotionClient } from "../../__tests__/helpers/mock-notion.js";

const mockClient = createMockNotionClient();
vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => mockClient),
}));

import { NotyClient } from "../../lib/client.js";
import { createNotyMcpServer } from "../server.js";

describe("MCP Server", () => {
  let client: NotyClient;
  let server: ReturnType<typeof createNotyMcpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new NotyClient({ token: "test-token" });
    server = createNotyMcpServer(client);
  });

  it("creates server with correct name and version", () => {
    expect(server).toBeDefined();
  });

  describe("notion-search", () => {
    it("calls client.search and returns JSON", async () => {
      const result = await client.search("test");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test Page");
    });
  });

  describe("notion-fetch", () => {
    it("calls client.getPage and returns markdown", async () => {
      const result = await client.getPage("page-id-1");
      expect(result).toBe("Hello World");
    });
  });

  describe("notion-create-pages", () => {
    it("creates a page via client", async () => {
      const result = await client.createPage({
        parentId: "parent-id",
        title: "Test",
        properties: { Name: "Test" },
        content: "# Hello",
      });
      expect(result.id).toBe("new-page-id");
      expect(mockClient.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { page_id: "parent-id" },
          children: expect.any(Array),
        }),
      );
    });

    it("handles multiple pages", async () => {
      await client.createPage({ parentId: "p1", title: "A" });
      await client.createPage({ parentId: "p2", title: "B" });
      expect(mockClient.pages.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("notion-update-page", () => {
    it("updates properties and content", async () => {
      await client.updatePage("page-id-1", {
        properties: { Name: "Updated" },
        content: "New content",
      });
      expect(mockClient.pages.update).toHaveBeenCalled();
      expect(mockClient.blocks.delete).toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });

    it("updates only properties when no content", async () => {
      await client.updatePage("page-id-1", {
        properties: { Name: "Updated" },
      });
      expect(mockClient.pages.update).toHaveBeenCalled();
      expect(mockClient.blocks.delete).not.toHaveBeenCalled();
    });

    it("updates only content when no properties", async () => {
      await client.updatePage("page-id-1", {
        content: "New content",
      });
      expect(mockClient.pages.update).not.toHaveBeenCalled();
      expect(mockClient.blocks.delete).toHaveBeenCalled();
      expect(mockClient.blocks.children.append).toHaveBeenCalled();
    });
  });

  describe("notion-get-comments", () => {
    it("returns comments list", async () => {
      const comments = await client.listComments("page-id-1");
      expect(comments).toHaveLength(1);
      expect(comments[0].richText).toBe("Test comment");
    });
  });

  describe("notion-create-comment", () => {
    it("creates a comment", async () => {
      const comment = await client.createComment("page-id-1", "Hello");
      expect(comment.id).toBe("comment-2");
      expect(mockClient.comments.create).toHaveBeenCalledWith({
        parent: { page_id: "page-id-1" },
        rich_text: [{ type: "text", text: { content: "Hello" } }],
      });
    });
  });

  describe("notion-get-users", () => {
    it("returns users", async () => {
      const users = await client.listUsers();
      expect(users).toHaveLength(2);
      expect(users[0].type).toBe("person");
      expect(users[1].type).toBe("bot");
    });
  });

  describe("notion-get-teams", () => {
    it("groups users by type", async () => {
      const users = await client.listUsers();
      const people = users.filter((u) => u.type === "person");
      const bots = users.filter((u) => u.type === "bot");
      expect(people).toHaveLength(1);
      expect(bots).toHaveLength(1);
    });
  });
});
