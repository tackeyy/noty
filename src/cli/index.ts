#!/usr/bin/env node
import { Command } from "commander";
import { NotyClient } from "../lib/client.js";

const program = new Command();

program
  .name("noty")
  .description("Notion CLI tool")
  .version("1.0.0")
  .option("--json", "Output in JSON format")
  .option("--plain", "Output in TSV format");

function getOutputMode(): "json" | "plain" | "human" {
  const opts = program.opts();
  if (opts.json) return "json";
  if (opts.plain) return "plain";
  return "human";
}

function createClient(): NotyClient {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("Error: NOTION_TOKEN environment variable is not set");
    process.exit(1);
  }
  return new NotyClient({ token });
}

function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// --- auth ---
const auth = program.command("auth").description("Authentication commands");

auth
  .command("test")
  .description("Test authentication with Notion API")
  .action(async () => {
    try {
      const client = createClient();
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
  .action(async (query, opts) => {
    try {
      const client = createClient();
      const mode = getOutputMode();
      const results = await client.search(query, {
        filter: opts.filter,
        limit: parseInt(opts.limit, 10),
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
      const client = createClient();
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
  .requiredOption("--title <title>", "Page title")
  .option("--content <markdown>", "Page content as Markdown")
  .option("--properties <json>", "Properties as JSON string")
  .action(async (opts) => {
    try {
      const client = createClient();
      const mode = getOutputMode();

      const properties = opts.properties
        ? JSON.parse(opts.properties)
        : undefined;

      const result = await client.createPage({
        parentId: opts.parent,
        title: opts.title,
        content: opts.content,
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
  .option("--content <markdown>", "New page content as Markdown")
  .option("--properties <json>", "Properties as JSON string")
  .action(async (id, opts) => {
    try {
      const client = createClient();
      const mode = getOutputMode();

      const properties = opts.properties
        ? JSON.parse(opts.properties)
        : opts.title
          ? { Name: opts.title }
          : undefined;

      const result = await client.updatePage(id, {
        properties,
        content: opts.content,
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

// --- databases ---
const databases = program
  .command("databases")
  .description("Database operations");

databases
  .command("query <id>")
  .description("Query a database")
  .option("--filter <json>", "Filter as JSON string")
  .option("--sorts <json>", "Sorts as JSON string")
  .option("--limit <n>", "Maximum results", "100")
  .action(async (id, opts) => {
    try {
      const client = createClient();
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
      const client = createClient();
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
  .requiredOption("--body <text>", "Comment text")
  .action(async (pageId, opts) => {
    try {
      const client = createClient();
      const mode = getOutputMode();
      const result = await client.createComment(pageId, opts.body);

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
      const client = createClient();
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

// --- mcp ---
program
  .command("mcp")
  .description("Start MCP server (stdio)")
  .action(async () => {
    const { createNotyMcpServer } = await import("../mcp/server.js");
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );

    const client = createClient();
    const mcpServer = createNotyMcpServer(client);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  });

program.parse();
