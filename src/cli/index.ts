#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClientFromEnv } from "../lib/client.js";
import type { NotionClientInterface } from "../lib/notion-client-interface.js";
import { readStdin } from "./stdin.js";
import {
  readConfig,
  writeConfig,
  clearAuthConfig,
  getOAuthToken,
  getTokenV2,
  getAuthType,
} from "../lib/auth-config.js";
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  waitForOAuthCallback,
  findFreePort,
} from "../lib/oauth.js";

function resolveContent(opts: { content?: string; contentFile?: string }): string | undefined {
  if (opts.content && opts.contentFile) {
    throw new Error("--content and --content-file cannot be used together");
  }
  if (opts.contentFile) {
    if (!existsSync(opts.contentFile)) {
      throw new Error(`--content-file: file not found: ${opts.contentFile}`);
    }
    return readFileSync(opts.contentFile, "utf-8");
  }
  return opts.content;
}

function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf-8"),
) as { version: string };

export function createProgram(injectedClient?: NotionClientInterface): Command {
  const program = new Command();

  program
    .name("noty")
    .description("Notion CLI tool")
    .version(pkg.version)
    .option("--json", "Output in JSON format")
    .option("--plain", "Output in TSV format");

  function getOutputMode(): "json" | "plain" | "human" {
    const opts = program.opts();
    if (opts.json) return "json";
    if (opts.plain) return "plain";
    return "human";
  }

  function getClient(): NotionClientInterface {
    if (injectedClient) return injectedClient;
    try {
      return createClientFromEnv({
        getIntegrationToken: () => process.env.NOTION_TOKEN ?? getOAuthToken(),
        getTokenV2: () => process.env.NOTION_TOKEN_V2 ?? getTokenV2(),
      });
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
      return undefined as never;
    }
  }

  // --- auth ---
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("set-cookie <token_v2>")
    .description("Save Notion browser session token (token_v2 cookie) for authentication")
    .action((tokenV2: string) => {
      if (!tokenV2 || tokenV2.trim() === "") {
        console.error("Error: token_v2 value is required");
        process.exit(1);
        return;
      }
      writeConfig({
        ...readConfig(),
        auth: { type: "token_v2", token_v2: tokenV2.trim() },
      });
      console.log("認証を設定しました (token_v2)");
    });

  auth
    .command("login")
    .description("Authenticate with Notion via OAuth (opens browser)")
    .action(async () => {
      const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
      const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        console.error(
          "Error: NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET must be set.\n" +
          "Create a public Notion integration at https://www.notion.so/my-integrations",
        );
        process.exit(1);
        return;
      }
      try {
        const port = await findFreePort();
        const redirectUri = `http://localhost:${port}/callback`;
        const authUrl = buildAuthorizationUrl(clientId, redirectUri);

        console.log(`\nOpening browser for Notion OAuth...\n${authUrl}\n`);
        try {
          const openCmd =
            process.platform === "darwin" ? `open "${authUrl}"` :
            process.platform === "win32" ? `start "" "${authUrl}"` :
            `xdg-open "${authUrl}"`;
          execSync(openCmd, { stdio: "ignore" });
        } catch {
          console.log("Could not open browser automatically. Please visit the URL above.");
        }

        console.log("Waiting for authentication...");
        const code = await waitForOAuthCallback(port);
        const tokenRes = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

        writeConfig({
          ...readConfig(),
          auth: {
            type: "oauth",
            access_token: tokenRes.access_token,
            bot_id: tokenRes.bot_id,
            workspace_id: tokenRes.workspace_id,
            workspace_name: tokenRes.workspace_name,
          },
        });

        console.log(`\n✓ Authenticated with workspace: ${tokenRes.workspace_name}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(() => {
      const authType = getAuthType();
      const mode = getOutputMode();

      if (authType === "integration") {
        if (mode === "json") {
          jsonOutput({ type: "integration", source: "NOTION_TOKEN" });
        } else if (mode === "plain") {
          console.log("integration\tNOTION_TOKEN");
        } else {
          console.log("Auth type:  Integration Token (NOTION_TOKEN)");
        }
      } else if (authType === "oauth") {
        const config = readConfig();
        const oauthAuth = config?.auth?.type === "oauth" ? config.auth : undefined;
        if (mode === "json") {
          jsonOutput({ type: "oauth", workspace: oauthAuth?.workspace_name, bot_id: oauthAuth?.bot_id });
        } else if (mode === "plain") {
          console.log(`oauth\t${oauthAuth?.workspace_name ?? ""}\t${oauthAuth?.bot_id ?? ""}`);
        } else {
          console.log("Auth type:  OAuth");
          console.log(`Workspace:  ${oauthAuth?.workspace_name ?? "(unknown)"}`);
          console.log(`Bot ID:     ${oauthAuth?.bot_id ?? "(unknown)"}`);
        }
      } else if (authType === "token_v2_env") {
        if (mode === "json") {
          jsonOutput({ type: "token_v2", source: "NOTION_TOKEN_V2" });
        } else if (mode === "plain") {
          console.log("token_v2_env\tNOTION_TOKEN_V2");
        } else {
          console.log("Auth type:  cookie (token_v2) — NOTION_TOKEN_V2");
        }
      } else if (authType === "token_v2") {
        if (mode === "json") {
          jsonOutput({ type: "token_v2", method: "cookie (token_v2)" });
        } else if (mode === "plain") {
          console.log("token_v2");
        } else {
          console.log("Auth type:  cookie (token_v2)");
        }
      } else {
        if (mode === "json") {
          jsonOutput({ type: "none" });
        } else if (mode === "plain") {
          console.log("none");
        } else {
          console.log("Not authenticated. Run 'noty auth login', 'noty auth set-cookie <token_v2>', or set NOTION_TOKEN.");
        }
      }
    });

  auth
    .command("logout")
    .description("Remove saved OAuth token or token_v2 cookie")
    .action(() => {
      const authType = getAuthType();
      if (authType === "oauth") {
        clearAuthConfig();
        console.log("Logged out. OAuth token removed.");
      } else if (authType === "token_v2") {
        clearAuthConfig();
        console.log("Logged out. token_v2 cookie removed.");
      } else if (authType === "integration") {
        console.log("Using NOTION_TOKEN (environment variable). No saved token to remove.");
      } else {
        console.log("Not authenticated.");
      }
    });

  auth
    .command("test")
    .description("Test authentication with Notion API")
    .action(async () => {
      try {
        const client = getClient();
        const info = await client.authTest();
        const mode = getOutputMode();

        if (mode === "json") {
          jsonOutput(info);
        } else if (mode === "plain") {
          console.log(`${info.botId}\t${info.workspaceName}\t${info.workspaceId}`);
        } else {
          console.log(`Bot ID: ${info.botId}`);
          console.log(`Workspace: ${info.workspaceName}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- search ---
  program
    .command("search <query>")
    .description("Search Notion pages and databases")
    .option("--filter <type>", "Filter by type (page or database)")
    .option("--limit <n>", "Maximum results", "10")
    .option("--sort <direction>", "Sort by last_edited_time (ascending or descending)")
    .action(async (query, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const sort = opts.sort
          ? { direction: opts.sort as "ascending" | "descending", timestamp: "last_edited_time" as const }
          : undefined;
        const results = await client.search(query, {
          filter: opts.filter,
          limit: parseInt(opts.limit, 10),
          sort,
        });

        if (mode === "json") {
          jsonOutput(results);
        } else if (mode === "plain") {
          for (const r of results) {
            console.log(`${r.id}\t${r.type}\t${r.title}\t${r.url}`);
          }
        } else {
          if (results.length === 0) {
            console.log("No results found");
          } else {
            for (const r of results) {
              const icon = r.type === "database" ? "DB" : "Page";
              console.log(`[${icon}] ${r.title}`);
              console.log(`  ID: ${r.id}`);
              console.log(`  URL: ${r.url}\n`);
            }
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- pages ---
  const pages = program.command("pages").description("Page operations");

  pages
    .command("get <id>")
    .description("Get page content as Markdown")
    .action(async (id) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        if (mode === "json") {
          const metadata = await client.getPageMetadata(id);
          const content = await client.getPage(id);
          jsonOutput({ ...metadata, content });
        } else {
          const content = await client.getPage(id);
          console.log(content);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pages
    .command("create")
    .description("Create a new page")
    .requiredOption("--parent <id>", "Parent page or database ID")
    .option("--parent-type <type>", "Parent type (page_id or database_id)")
    .option("--title <title>", "Page title")
    .option("--content <markdown>", "Page content as Markdown (use '-' to read from stdin)")
    .option("--content-file <path>", "Read page content from a file")
    .option("--properties <json>", "Properties as JSON string (use '-' to read from stdin)")
    .action(async (opts) => {
      try {
        if (!opts.title && !opts.properties) {
          console.error("Error: --title or --properties is required");
          process.exit(1);
        }

        if (opts.parentType && opts.parentType !== "page_id" && opts.parentType !== "database_id") {
          console.error('Error: --parent-type must be "page_id" or "database_id"');
          process.exit(1);
          return;
        }

        const client = getClient();
        const mode = getOutputMode();

        let content = resolveContent(opts);
        if (content === "-") content = await readStdin();

        let properties = opts.properties;
        if (properties === "-") properties = await readStdin();
        properties = properties ? JSON.parse(properties) : undefined;

        const result = await client.createPage({
          parentId: opts.parent,
          parentType: opts.parentType,
          title: opts.title,
          content,
          properties,
        });

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`Page created: ${result.title}`);
          console.log(`  ID: ${result.id}`);
          console.log(`  URL: ${result.url}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pages
    .command("update <id>")
    .description("Update a page")
    .option("--title <title>", "New page title")
    .option("--content <markdown>", "New page content as Markdown (use '-' to read from stdin)")
    .option("--content-file <path>", "Read page content from a file")
    .option("--properties <json>", "Properties as JSON string (use '-' to read from stdin)")
    .option("--append", "Append content instead of replacing")
    .action(async (id, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        let content = resolveContent(opts);
        if (content === "-") content = await readStdin();

        let properties = opts.properties;
        if (properties === "-") properties = await readStdin();
        properties = properties
          ? JSON.parse(properties)
          : opts.title
            ? { Name: opts.title }
            : undefined;

        const result = await client.updatePage(id, {
          properties,
          content,
          mode: opts.append ? "append" : "replace",
        });

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`Page updated: ${result.title}`);
          console.log(`  ID: ${result.id}`);
          console.log(`  URL: ${result.url}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pages
    .command("clear <id>")
    .description("Delete all content blocks from a page")
    .action(async (id) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        const result = await client.clearPage(id);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`Page cleared: ${result.title}`);
          console.log(`  ID: ${result.id}`);
          console.log(`  URL: ${result.url}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pages
    .command("archive <id>")
    .description("Archive (soft-delete) a page")
    .action(async (id) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        const result = await client.archivePage(id);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`Page archived: ${result.title}`);
          console.log(`  ID: ${result.id}`);
          console.log(`  URL: ${result.url}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- databases ---
  const databases = program
    .command("databases")
    .description("Database operations");

  databases
    .command("get <id>")
    .description("Get database schema and metadata")
    .action(async (id) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.getDatabase(id);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`${result.title}`);
          console.log(`  ID: ${result.id}`);
          console.log(`  URL: ${result.url}`);
          console.log(`  Created: ${result.createdTime}`);
          console.log(`  Last edited: ${result.lastEditedTime}`);
          console.log(`  Properties:`);
          for (const [name, prop] of Object.entries(result.properties)) {
            const p = prop as Record<string, unknown>;
            console.log(`    - ${name} (${p.type})`);
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  databases
    .command("query <id>")
    .description("Query a database")
    .option("--filter <json>", "Filter as JSON string")
    .option("--sorts <json>", "Sorts as JSON string")
    .option("--limit <n>", "Maximum results", "100")
    .action(async (id, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        const result = await client.queryDatabase(id, {
          filter: opts.filter ? JSON.parse(opts.filter) : undefined,
          sorts: opts.sorts ? JSON.parse(opts.sorts) : undefined,
          pageSize: parseInt(opts.limit, 10),
        });

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          for (const r of result.results) {
            console.log(`${r.id}\t${r.title}\t${r.url}`);
          }
        } else {
          console.log(`Found ${result.results.length} results`);
          if (result.hasMore) console.log(`(more results available)`);
          console.log();
          for (const r of result.results) {
            console.log(`  ${r.title}`);
            console.log(`    ID: ${r.id}`);
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- comments ---
  const comments = program.command("comments").description("Comment operations");

  comments
    .command("list <page_id>")
    .description("List comments on a page")
    .action(async (pageId) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.listComments(pageId);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          for (const c of result) {
            console.log(`${c.id}\t${c.createdBy.id}\t${c.createdTime}\t${c.richText}`);
          }
        } else {
          if (result.length === 0) {
            console.log("No comments");
          } else {
            for (const c of result) {
              console.log(`[${c.createdTime}] ${c.createdBy.id}:`);
              console.log(`  ${c.richText}\n`);
            }
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  comments
    .command("add <page_id>")
    .description("Add a comment to a page")
    .requiredOption("--body <text>", "Comment text (use '-' to read from stdin)")
    .action(async (pageId, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        let body = opts.body;
        if (body === "-") body = await readStdin();

        const result = await client.createComment(pageId, body);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.richText}`);
        } else {
          console.log(`Comment added (ID: ${result.id})`);
          console.log(`  ${result.richText}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- users ---
  const users = program.command("users").description("User operations");

  users
    .command("list")
    .description("List workspace users")
    .action(async () => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.listUsers();

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          for (const u of result) {
            console.log(`${u.id}\t${u.type}\t${u.name}\t${u.email || ""}`);
          }
        } else {
          for (const u of result) {
            const typeLabel = u.type === "bot" ? " (bot)" : "";
            console.log(`${u.name}${typeLabel}`);
            console.log(`  ID: ${u.id}`);
            if (u.email) console.log(`  Email: ${u.email}`);
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- files ---
  const files = program.command("files").description("File upload operations");

  files
    .command("upload <file_path>")
    .description("Upload a file to Notion via Direct Upload")
    .action(async (filePath: string) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        const result = await client.uploadFile(filePath);

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.status}\t${result.filename}`);
        } else {
          console.log(`File uploaded: ${result.filename}`);
          console.log(`  ID:      ${result.id}`);
          console.log(`  Status:  ${result.status}`);
          if (result.expiryTime) console.log(`  Expires: ${result.expiryTime}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- pages attach-file ---
  pages
    .command("attach-file <page_id> <file_path>")
    .description("Upload a file and attach it to a Notion page as a file block")
    .option("--caption <text>", "Caption text for the file block")
    .action(async (pageId: string, filePath: string, opts: { caption?: string }) => {
      try {
        const client = getClient();
        const mode = getOutputMode();

        const result = await client.attachFileToPage(pageId, filePath, {
          caption: opts.caption,
        });

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.id}\t${result.title}\t${result.url}`);
        } else {
          console.log(`File attached to page: ${result.title}`);
          console.log(`  Page ID: ${result.id}`);
          console.log(`  URL:     ${result.url}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  return program;
}

// Only parse when this module is the entry point
// Note: process.argv[1] may be a symlink name (e.g., "noty") via npm link,
// so we resolve symlinks before checking the file extension
import { realpathSync } from "node:fs";

/** Resolve symlinks and check if the path points to this module's entry file */
export function checkIsMain(scriptPath: string): boolean {
  const resolved = (() => { try { return realpathSync(scriptPath); } catch { return scriptPath; } })();
  return resolved.endsWith("index.js") || resolved.endsWith("index.ts");
}

const isMain = checkIsMain(process.argv[1] ?? "");
if (isMain) {
  createProgram().parse();
}
