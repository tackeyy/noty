import { Client } from "@notionhq/client";
import { extractNotionId } from "./url-parser.js";
import { blocksToMarkdown } from "./blocks-to-markdown.js";
import { markdownToBlocks } from "./markdown-to-blocks.js";
import { buildProperties } from "./property-builder.js";
import type {
  NotyClientOptions,
  SearchResult,
  SearchSort,
  PageResult,
  DatabaseResult,
  CreatePageArgs,
  UpdatePageArgs,
  QueryDatabaseArgs,
  QueryResult,
  NotionComment,
  NotionUser,
  AuthInfo,
} from "./types.js";

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, any> | undefined;
  if (!props) return "";

  // Find the title property
  for (const val of Object.values(props)) {
    if (val?.type === "title" && Array.isArray(val.title)) {
      return val.title.map((t: any) => t.plain_text || "").join("");
    }
  }
  return "";
}

function pageToResult(page: Record<string, any>): PageResult {
  return {
    id: page.id,
    title: extractTitle(page),
    url: page.url || "",
    createdTime: page.created_time || "",
    lastEditedTime: page.last_edited_time || "",
    properties: page.properties || {},
  };
}

export class NotyClient {
  private client: Client;

  constructor(opts: NotyClientOptions) {
    if (!opts.token) {
      throw new Error("Notion token is required");
    }
    this.client = new Client({ auth: opts.token });
  }

  async search(
    query: string,
    opts?: { filter?: "page" | "database"; limit?: number; sort?: SearchSort },
  ): Promise<SearchResult[]> {
    const params: Record<string, unknown> = {
      query,
      page_size: opts?.limit ?? 10,
    };
    if (opts?.filter) {
      params.filter = { property: "object", value: opts.filter };
    }
    if (opts?.sort) {
      params.sort = opts.sort;
    }

    const res = await this.client.search(params as any);

    return res.results.map((item: any) => ({
      id: item.id,
      title: extractTitle(item) || (item.title?.[0]?.plain_text ?? ""),
      type: item.object === "database" ? "database" : "page",
      url: item.url || "",
      lastEditedTime: item.last_edited_time || "",
    }));
  }

  async getPage(idOrUrl: string): Promise<string> {
    const pageId = extractNotionId(idOrUrl);

    // Get blocks
    const blocks: any[] = [];
    let cursor: string | undefined;

    do {
      const res = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });
      blocks.push(...res.results);
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    // Convert to markdown with recursive child fetching
    const markdown = await blocksToMarkdown(blocks as any, {
      fetchChildren: async (blockId: string) => {
        const childBlocks: any[] = [];
        let childCursor: string | undefined;
        do {
          const res = await this.client.blocks.children.list({
            block_id: blockId,
            page_size: 100,
            start_cursor: childCursor,
          });
          childBlocks.push(...res.results);
          childCursor = res.has_more
            ? (res.next_cursor ?? undefined)
            : undefined;
        } while (childCursor);
        return childBlocks as any;
      },
    });

    return markdown;
  }

  async getPageMetadata(idOrUrl: string): Promise<PageResult> {
    const pageId = extractNotionId(idOrUrl);
    const page = await this.client.pages.retrieve({ page_id: pageId });
    return pageToResult(page as any);
  }

  async createPage(args: CreatePageArgs): Promise<PageResult> {
    const parentId = extractNotionId(args.parentId);

    // Build properties
    const properties = args.properties
      ? buildProperties(args.properties as Record<string, unknown>)
      : {};

    // Always set title
    if (args.title && !properties.Name) {
      properties.Name = {
        title: [{ text: { content: args.title } }],
      };
    }

    // Determine parent type
    const parentType = args.parentType || "page_id";
    const createArgs: Record<string, unknown> = {
      parent: { [parentType]: parentId },
      properties,
    };

    // Add content blocks if provided
    if (args.content) {
      createArgs.children = markdownToBlocks(args.content);
    }

    const page = await this.client.pages.create(createArgs as any);
    return pageToResult(page as any);
  }

  async updatePage(
    idOrUrl: string,
    args: UpdatePageArgs,
  ): Promise<PageResult> {
    const pageId = extractNotionId(idOrUrl);

    // Update properties if provided
    if (args.properties) {
      const properties = buildProperties(
        args.properties as Record<string, unknown>,
      );
      await this.client.pages.update({
        page_id: pageId,
        properties: properties as any,
      });
    }

    // Update content if provided (archive existing blocks + append new ones)
    if (args.content) {
      // Get existing blocks
      const existing = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });

      // Delete existing blocks
      for (const block of existing.results) {
        await this.client.blocks.delete({ block_id: (block as any).id });
      }

      // Append new blocks
      const newBlocks = markdownToBlocks(args.content);
      if (newBlocks.length > 0) {
        await this.client.blocks.children.append({
          block_id: pageId,
          children: newBlocks as any,
        });
      }
    }

    // Retrieve updated page
    const page = await this.client.pages.retrieve({ page_id: pageId });
    return pageToResult(page as any);
  }

  async getDatabase(idOrUrl: string): Promise<DatabaseResult> {
    const dbId = extractNotionId(idOrUrl);
    const db = (await this.client.databases.retrieve({
      database_id: dbId,
    })) as any;

    // Extract title from database title array
    const title = (db.title || [])
      .map((t: any) => t.plain_text || "")
      .join("");

    return {
      id: db.id,
      title,
      url: db.url || "",
      createdTime: db.created_time || "",
      lastEditedTime: db.last_edited_time || "",
      properties: db.properties || {},
    };
  }

  async queryDatabase(
    dbIdOrUrl: string,
    opts?: QueryDatabaseArgs,
  ): Promise<QueryResult> {
    const dbId = extractNotionId(dbIdOrUrl);

    const params: Record<string, unknown> = {
      database_id: dbId,
      page_size: opts?.pageSize ?? 100,
    };
    if (opts?.filter) params.filter = opts.filter;
    if (opts?.sorts) params.sorts = opts.sorts;
    if (opts?.startCursor) params.start_cursor = opts.startCursor;

    const res = await this.client.databases.query(params as any);

    return {
      results: res.results.map((page: any) => pageToResult(page)),
      hasMore: res.has_more,
      nextCursor: res.next_cursor ?? null,
    };
  }

  async listComments(
    pageIdOrUrl: string,
  ): Promise<NotionComment[]> {
    const pageId = extractNotionId(pageIdOrUrl);
    const comments: NotionComment[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, unknown> = {
        block_id: pageId,
        page_size: 100,
      };
      if (cursor) params.start_cursor = cursor;

      const res = await this.client.comments.list(params as any);

      for (const comment of res.results as any[]) {
        comments.push({
          id: comment.id,
          createdTime: comment.created_time,
          lastEditedTime: comment.last_edited_time || comment.created_time,
          createdBy: {
            id: comment.created_by?.id || "",
            name: comment.created_by?.name,
          },
          richText: (comment.rich_text || [])
            .map((rt: any) => rt.plain_text || "")
            .join(""),
        });
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return comments;
  }

  async createComment(
    pageIdOrUrl: string,
    body: string,
  ): Promise<NotionComment> {
    const pageId = extractNotionId(pageIdOrUrl);

    const res = (await this.client.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ type: "text" as const, text: { content: body } }],
    })) as any;

    return {
      id: res.id,
      createdTime: res.created_time,
      lastEditedTime: res.last_edited_time || res.created_time,
      createdBy: {
        id: res.created_by?.id || "",
        name: res.created_by?.name,
      },
      richText: (res.rich_text || [])
        .map((rt: any) => rt.plain_text || "")
        .join(""),
    };
  }

  async listUsers(): Promise<NotionUser[]> {
    const users: NotionUser[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, unknown> = { page_size: 100 };
      if (cursor) params.start_cursor = cursor;

      const res = await this.client.users.list(params as any);

      for (const user of res.results as any[]) {
        users.push({
          id: user.id,
          name: user.name || "",
          type: user.type === "bot" ? "bot" : "person",
          email: user.person?.email,
          avatarUrl: user.avatar_url,
        });
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return users;
  }

  async authTest(): Promise<AuthInfo> {
    const res = (await this.client.users.me({})) as any;
    return {
      botId: res.id || "",
      workspaceName: res.bot?.workspace_name || "",
      workspaceId: res.bot?.owner?.workspace ? "true" : res.id,
    };
  }
}
