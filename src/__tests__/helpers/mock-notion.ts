import { vi } from "vitest";

export function createMockNotionClient() {
  return {
    search: vi.fn().mockResolvedValue({
      results: [
        {
          id: "page-id-1",
          object: "page",
          url: "https://notion.so/Page-1",
          created_time: "2026-01-01T00:00:00.000Z",
          last_edited_time: "2026-01-02T00:00:00.000Z",
          properties: {
            Name: {
              type: "title",
              title: [{ plain_text: "Test Page" }],
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    }),
    pages: {
      retrieve: vi.fn().mockResolvedValue({
        id: "page-id-1",
        object: "page",
        url: "https://notion.so/Page-1",
        created_time: "2026-01-01T00:00:00.000Z",
        last_edited_time: "2026-01-02T00:00:00.000Z",
        properties: {
          Name: {
            type: "title",
            title: [{ plain_text: "Test Page" }],
          },
        },
      }),
      create: vi.fn().mockResolvedValue({
        id: "new-page-id",
        object: "page",
        url: "https://notion.so/New-Page",
        created_time: "2026-01-03T00:00:00.000Z",
        last_edited_time: "2026-01-03T00:00:00.000Z",
        properties: {
          Name: {
            type: "title",
            title: [{ plain_text: "New Page" }],
          },
        },
      }),
      update: vi.fn().mockResolvedValue({
        id: "page-id-1",
        object: "page",
        url: "https://notion.so/Page-1",
        created_time: "2026-01-01T00:00:00.000Z",
        last_edited_time: "2026-01-04T00:00:00.000Z",
        properties: {
          Name: {
            type: "title",
            title: [{ plain_text: "Updated Page" }],
          },
        },
      }),
    },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({
          results: [
            {
              id: "block-1",
              type: "paragraph",
              has_children: false,
              paragraph: {
                rich_text: [{ plain_text: "Hello World", type: "text", text: { content: "Hello World" } }],
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
        append: vi.fn().mockResolvedValue({ results: [] }),
      },
      delete: vi.fn().mockResolvedValue({}),
    },
    databases: {
      retrieve: vi.fn().mockResolvedValue({
        id: "db-id-1",
        object: "database",
        url: "https://notion.so/DB-1",
        created_time: "2026-01-01T00:00:00.000Z",
        last_edited_time: "2026-01-02T00:00:00.000Z",
        title: [{ plain_text: "Test Database" }],
        properties: {
          Name: { id: "title", name: "Name", type: "title", title: {} },
          Status: { id: "status", name: "Status", type: "select", select: { options: [] } },
        },
      }),
      query: vi.fn().mockResolvedValue({
        results: [
          {
            id: "row-1",
            object: "page",
            url: "https://notion.so/Row-1",
            created_time: "2026-01-01T00:00:00.000Z",
            last_edited_time: "2026-01-02T00:00:00.000Z",
            properties: {
              Name: {
                type: "title",
                title: [{ plain_text: "Row 1" }],
              },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
    },
    comments: {
      list: vi.fn().mockResolvedValue({
        results: [
          {
            id: "comment-1",
            created_time: "2026-01-01T00:00:00.000Z",
            last_edited_time: "2026-01-01T00:00:00.000Z",
            created_by: { id: "user-1", name: "Test User" },
            rich_text: [{ plain_text: "Test comment" }],
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
      create: vi.fn().mockResolvedValue({
        id: "comment-2",
        created_time: "2026-01-02T00:00:00.000Z",
        last_edited_time: "2026-01-02T00:00:00.000Z",
        created_by: { id: "bot-1" },
        rich_text: [{ plain_text: "New comment" }],
      }),
    },
    users: {
      list: vi.fn().mockResolvedValue({
        results: [
          {
            id: "user-1",
            name: "Test User",
            type: "person",
            person: { email: "test@example.com" },
            avatar_url: "https://example.com/avatar.png",
          },
          {
            id: "bot-1",
            name: "Bot",
            type: "bot",
            avatar_url: null,
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
      me: vi.fn().mockResolvedValue({
        id: "bot-1",
        name: "Noty Bot",
        type: "bot",
        bot: {
          workspace_name: "Test Workspace",
          owner: { workspace: true },
        },
      }),
    },
  };
}
