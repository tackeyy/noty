import { blocksToMarkdown } from "./blocks-to-markdown.js";
import { extractNotionId, toUuid } from "./url-parser.js";
import type {
  AuthInfo,
  AttachFileArgs,
  CreatePageArgs,
  DatabaseResult,
  FileUploadResult,
  NotionComment,
  NotionUser,
  PageResult,
  QueryDatabaseArgs,
  QueryResult,
  SearchResult,
  SearchSort,
  UpdatePageArgs,
} from "./types.js";
import type { NotionClientInterface } from "./notion-client-interface.js";

type InternalRecordMap = {
  block?: Record<string, { value?: any }>;
};

export interface InternalNotionClientOptions {
  tokenV2: string;
  fetchImpl?: typeof fetch;
}

export class InternalNotionClient implements NotionClientInterface {
  private readonly tokenV2: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl = "https://www.notion.so/api/v3";

  constructor(opts: InternalNotionClientOptions) {
    if (!opts.tokenV2) {
      throw new Error("token_v2 is required");
    }
    this.tokenV2 = opts.tokenV2;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<any> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token_v2=${this.tokenV2}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Internal API ${path} failed: ${res.status} ${body}`);
    }

    return res.json();
  }

  private notionTextToPlain(title: unknown): string {
    if (!Array.isArray(title)) return "";
    return title
      .map((part) => (Array.isArray(part) ? String(part[0] ?? "") : ""))
      .join("");
  }

  private toIsoFromNotionTimestamp(v: unknown): string {
    if (typeof v === "number") {
      return new Date(v).toISOString();
    }
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return new Date(n).toISOString();
    }
    return "";
  }

  private normalizeBlockType(type: string): string {
    if (type === "text") return "paragraph";
    if (type === "sub_header") return "heading_2";
    if (type === "sub_sub_header") return "heading_3";
    return type;
  }

  private mapBlockToNotionApiShape(value: any): any {
    const type = this.normalizeBlockType(value.type ?? "paragraph");
    const richText = [
      {
        type: "text",
        text: { content: this.notionTextToPlain(value.properties?.title) },
        plain_text: this.notionTextToPlain(value.properties?.title),
      },
    ];

    const mapped: any = {
      id: value.id,
      type,
      has_children: Array.isArray(value.content) && value.content.length > 0,
      created_time: this.toIsoFromNotionTimestamp(value.created_time),
      last_edited_time: this.toIsoFromNotionTimestamp(value.last_edited_time),
    };

    if (type === "to_do") {
      mapped[type] = {
        rich_text: richText,
        checked: !!value.properties?.checked,
      };
    } else {
      mapped[type] = { rich_text: richText };
    }

    return mapped;
  }

  private async loadPageRecordMap(pageId: string): Promise<InternalRecordMap> {
    const response = await this.post("/loadPageChunk", {
      pageId: toUuid(pageId),
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    });
    return response.recordMap ?? {};
  }

  private async fetchBlocks(ids: string[]): Promise<Record<string, { value?: any }>> {
    if (ids.length === 0) return {};
    const response = await this.post("/syncRecordValues", {
      requests: [
        {
          table: "block",
          id: ids.map((id) => toUuid(id)),
          version: -1,
        },
      ],
    });
    return response.recordMap?.block ?? {};
  }

  private async getPageBlocks(pageId: string): Promise<any[]> {
    const recordMap = await this.loadPageRecordMap(pageId);
    const blockMap = { ...(recordMap.block ?? {}) };

    const page = blockMap[toUuid(pageId)]?.value;
    const topLevelIds: string[] = Array.isArray(page?.content) ? page.content : [];

    const missingIds = topLevelIds.filter((id) => !blockMap[toUuid(id)]);
    if (missingIds.length > 0) {
      const fetched = await this.fetchBlocks(missingIds);
      Object.assign(blockMap, fetched);
    }

    return topLevelIds
      .map((id) => blockMap[toUuid(id)]?.value)
      .filter(Boolean)
      .map((value) => this.mapBlockToNotionApiShape(value));
  }

  async search(
    query: string,
    opts?: { filter?: "page" | "database"; limit?: number; sort?: SearchSort },
  ): Promise<SearchResult[]> {
    const res = await this.post("/search", {
      query,
      limit: opts?.limit ?? 10,
      source: "quick_find_public",
      sort: opts?.sort,
      filter: opts?.filter,
    });

    const results = Array.isArray(res.results) ? res.results : [];
    return results.map((item: any) => ({
      id: item.id,
      title: this.notionTextToPlain(item.properties?.title),
      type: item.object === "collection" ? "database" : "page",
      url: item.url ?? "",
      lastEditedTime: this.toIsoFromNotionTimestamp(item.last_edited_time),
    }));
  }

  async getPage(idOrUrl: string): Promise<string> {
    const pageId = extractNotionId(idOrUrl);
    const blocks = await this.getPageBlocks(pageId);
    return blocksToMarkdown(blocks as any);
  }

  async getPageMetadata(idOrUrl: string): Promise<PageResult> {
    const pageId = extractNotionId(idOrUrl);
    const recordMap = await this.loadPageRecordMap(pageId);
    const page = recordMap.block?.[toUuid(pageId)]?.value;

    return {
      id: page?.id ?? pageId,
      title: this.notionTextToPlain(page?.properties?.title),
      url: page?.properties?.href ?? "",
      createdTime: this.toIsoFromNotionTimestamp(page?.created_time),
      lastEditedTime: this.toIsoFromNotionTimestamp(page?.last_edited_time),
      properties: page?.properties ?? {},
    };
  }

  async createPage(_args: CreatePageArgs): Promise<PageResult> {
    throw new Error("createPage is not supported with token_v2 internal API client");
  }

  async updatePage(_idOrUrl: string, _args: UpdatePageArgs): Promise<PageResult> {
    throw new Error("updatePage is not supported with token_v2 internal API client");
  }

  async clearPage(_idOrUrl: string): Promise<PageResult> {
    throw new Error("clearPage is not supported with token_v2 internal API client");
  }

  async archivePage(_idOrUrl: string): Promise<PageResult> {
    throw new Error("archivePage is not supported with token_v2 internal API client");
  }

  async getDatabase(_idOrUrl: string): Promise<DatabaseResult> {
    throw new Error("getDatabase is not supported with token_v2 internal API client");
  }

  async queryDatabase(
    _dbIdOrUrl: string,
    _opts?: QueryDatabaseArgs,
  ): Promise<QueryResult> {
    throw new Error("queryDatabase is not supported with token_v2 internal API client");
  }

  async listComments(_pageIdOrUrl: string): Promise<NotionComment[]> {
    throw new Error("listComments is not supported with token_v2 internal API client");
  }

  async createComment(_pageIdOrUrl: string, _body: string): Promise<NotionComment> {
    throw new Error("createComment is not supported with token_v2 internal API client");
  }

  async listUsers(): Promise<NotionUser[]> {
    throw new Error("listUsers is not supported with token_v2 internal API client");
  }

  async authTest(): Promise<AuthInfo> {
    throw new Error("authTest is not supported with token_v2 internal API client");
  }

  async uploadFile(_filePath: string): Promise<FileUploadResult> {
    throw new Error("uploadFile is not supported with token_v2 internal API client. Use NOTION_TOKEN (integration token) instead.");
  }

  async attachFileToPage(
    _pageIdOrUrl: string,
    _filePath: string,
    _args?: AttachFileArgs,
  ): Promise<PageResult> {
    throw new Error("attachFileToPage is not supported with token_v2 internal API client. Use NOTION_TOKEN (integration token) instead.");
  }
}
