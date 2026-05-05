import { describe, it, expect, vi } from "vitest";
import { InternalNotionClient } from "../internal-client.js";

describe("InternalNotionClient", () => {
  it("uses token_v2 cookie and maps loadPageChunk to markdown", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recordMap: {
              block: {
                root: {
                  value: {
                    id: "root",
                    type: "page",
                    content: ["child1"],
                    created_time: 1,
                    last_edited_time: 2,
                  },
                },
                child1: {
                  value: {
                    id: "child1",
                    type: "text",
                    properties: { title: [["Hello internal"]] },
                    created_time: 1,
                    last_edited_time: 2,
                  },
                },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ recordMap: { block: {} } }), { status: 200 }),
      );

    const client = new InternalNotionClient({ tokenV2: "cookie-token", fetchImpl: fetchMock });
    const markdown = await client.getPage("root");

    expect(markdown).toContain("Hello internal");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v3/loadPageChunk");
    expect((init.headers as Record<string, string>).Cookie).toBe("token_v2=cookie-token");
  });

  it("maps search result into SearchResult[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "page-1",
              object: "page",
              url: "https://notion.so/page-1",
              last_edited_time: 12345,
              properties: { title: [["Page Title"]] },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new InternalNotionClient({ tokenV2: "cookie-token", fetchImpl: fetchMock });
    const results = await client.search("Page", { limit: 5 });

    expect(results).toEqual([
      {
        id: "page-1",
        title: "Page Title",
        type: "page",
        url: "https://notion.so/page-1",
        lastEditedTime: expect.any(String),
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v3/search"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
