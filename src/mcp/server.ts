import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NotyClient } from "../lib/client.js";
import { extractNotionId } from "../lib/url-parser.js";
import { buildProperties } from "../lib/property-builder.js";

export function createNotyMcpServer(client: NotyClient): McpServer {
  const server = new McpServer({
    name: "noty",
    version: "1.0.0",
  });

  // notion-search
  server.tool(
    "notion-search",
    "Search for pages and databases in Notion",
    { query: z.string().describe("Search query text") },
    async ({ query }) => {
      const results = await client.search(query);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );

  // notion-fetch
  server.tool(
    "notion-fetch",
    "Fetch a Notion page content as Markdown",
    { id: z.string().describe("Page ID or URL") },
    async ({ id }) => {
      const markdown = await client.getPage(id);
      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    },
  );

  // notion-create-pages
  server.tool(
    "notion-create-pages",
    "Create one or more pages in Notion",
    {
      parent: z
        .object({
          page_id: z.string().optional(),
          database_id: z.string().optional(),
          data_source_id: z.string().optional(),
        })
        .describe("Parent page, database, or data source"),
      pages: z
        .array(
          z.object({
            properties: z
              .record(z.unknown())
              .optional()
              .describe("Page properties"),
            content: z.string().optional().describe("Page content as Markdown"),
          }),
        )
        .describe("Pages to create"),
    },
    async ({ parent, pages }) => {
      const parentId =
        parent.page_id || parent.database_id || parent.data_source_id || "";
      const results = [];

      for (const page of pages) {
        // Extract title from properties
        const props = (page.properties || {}) as Record<string, unknown>;
        const title = typeof props.Name === "string" ? props.Name : "";

        const result = await client.createPage({
          parentId,
          title,
          properties: props,
          content: page.content,
        });
        results.push(result);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );

  // notion-update-page
  server.tool(
    "notion-update-page",
    "Update a Notion page's properties and/or content",
    {
      pageId: z.string().describe("Page ID or URL"),
      properties: z
        .record(z.unknown())
        .optional()
        .describe("Properties to update"),
      content: z
        .string()
        .optional()
        .describe("New page content as Markdown (replaces existing)"),
    },
    async ({ pageId, properties, content }) => {
      const result = await client.updatePage(pageId, {
        properties: properties as Record<string, unknown>,
        content,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // notion-get-comments
  server.tool(
    "notion-get-comments",
    "Get comments on a Notion page",
    {
      resourceUri: z.string().describe("Page ID or URL"),
    },
    async ({ resourceUri }) => {
      const comments = await client.listComments(resourceUri);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(comments, null, 2),
          },
        ],
      };
    },
  );

  // notion-create-comment
  server.tool(
    "notion-create-comment",
    "Add a comment to a Notion page",
    {
      page_id: z.string().describe("Page ID or URL"),
      body: z.string().describe("Comment text"),
    },
    async ({ page_id, body }) => {
      const comment = await client.createComment(page_id, body);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(comment, null, 2),
          },
        ],
      };
    },
  );

  // notion-get-users
  server.tool(
    "notion-get-users",
    "List all users in the Notion workspace",
    {},
    async () => {
      const users = await client.listUsers();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    },
  );

  // notion-get-teams
  server.tool(
    "notion-get-teams",
    "List teams in the Notion workspace (returns users grouped by type)",
    {},
    async () => {
      // Notion API doesn't have a direct teams endpoint;
      // return users grouped by type as a reasonable approximation
      const users = await client.listUsers();
      const people = users.filter((u) => u.type === "person");
      const bots = users.filter((u) => u.type === "bot");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ people, bots }, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
