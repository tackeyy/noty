export interface NotyClientOptions {
  token: string;
}

export interface SearchResult {
  id: string;
  title: string;
  type: "page" | "database";
  url: string;
  lastEditedTime: string;
}

export interface PageResult {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

export interface SearchSort {
  direction: "ascending" | "descending";
  timestamp: "last_edited_time";
}

export interface CreatePageArgs {
  parentId: string;
  parentType?: "page_id" | "database_id";
  title: string;
  properties?: Record<string, unknown>;
  content?: string;
}

export interface UpdatePageArgs {
  properties?: Record<string, unknown>;
  content?: string;
}

export interface QueryDatabaseArgs {
  filter?: Record<string, unknown>;
  sorts?: Array<Record<string, unknown>>;
  pageSize?: number;
  startCursor?: string;
}

export interface QueryResult {
  results: PageResult[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface NotionComment {
  id: string;
  createdTime: string;
  lastEditedTime: string;
  createdBy: { id: string; name?: string };
  richText: string;
}

export interface NotionUser {
  id: string;
  name: string;
  type: "person" | "bot";
  email?: string;
  avatarUrl?: string;
}

export interface DatabaseResult {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

export interface AuthInfo {
  botId: string;
  workspaceName: string;
  workspaceId: string;
}
