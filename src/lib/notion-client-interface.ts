import type {
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
  FileUploadResult,
  AttachFileArgs,
} from "./types.js";

export interface NotionClientInterface {
  search(
    query: string,
    opts?: {
      filter?: "page" | "database";
      limit?: number;
      sort?: SearchSort;
      all?: boolean;
    },
  ): Promise<SearchResult[]>;
  getPage(idOrUrl: string): Promise<string>;
  getPageMetadata(idOrUrl: string): Promise<PageResult>;
  createPage(args: CreatePageArgs): Promise<PageResult>;
  updatePage(idOrUrl: string, args: UpdatePageArgs): Promise<PageResult>;
  clearPage(idOrUrl: string): Promise<PageResult>;
  archivePage(idOrUrl: string): Promise<PageResult>;
  getDatabase(idOrUrl: string): Promise<DatabaseResult>;
  queryDatabase(dbIdOrUrl: string, opts?: QueryDatabaseArgs): Promise<QueryResult>;
  listComments(pageIdOrUrl: string): Promise<NotionComment[]>;
  createComment(pageIdOrUrl: string, body: string): Promise<NotionComment>;
  listUsers(): Promise<NotionUser[]>;
  authTest(): Promise<AuthInfo>;
  uploadFile(filePath: string): Promise<FileUploadResult>;
  attachFileToPage(pageIdOrUrl: string, filePath: string, args?: AttachFileArgs): Promise<PageResult>;
}
