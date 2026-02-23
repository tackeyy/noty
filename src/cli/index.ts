#!/usr/bin/env node
import { Command } from "commander";
import { NotyClient } from "../lib/client.js";
import { readStdin } from "./stdin.js";

const program = new Command();

program
  .name("noty")
  .description("Notion CLI tool")
  .version("1.1.0")
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
  .option("--sort <direction>", "Sort by last_edited_time (ascending or descending)")
  .action(async (query, opts) => {
    try {
      const client = createClient();
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
  .option("--title <title>", "Page title")
  .option("--content <markdown>", "Page content as Markdown (use '-' to read from stdin)")
  .option("--properties <json>", "Properties as JSON string (use '-' to read from stdin)")
  .action(async (opts) => {
    try {
      if (!opts.title && !opts.properties) {
        console.error("Error: --title or --properties is required");
        process.exit(1);
      }

      const client = createClient();
      const mode = getOutputMode();

      let content = opts.content;
      if (content === "-") content = await readStdin();

      let properties = opts.properties;
      if (properties === "-") properties = await readStdin();
      properties = properties ? JSON.parse(properties) : undefined;

      const result = await client.createPage({
        parentId: opts.parent,
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
  .option("--properties <json>", "Properties as JSON string (use '-' to read from stdin)")
  .option("--append", "Append content instead of replacing")
  .action(async (id, opts) => {
    try {
      const client = createClient();
      const mode = getOutputMode();

      let content = opts.content;
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
      const client = createClient();
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

// --- databases ---
const databases = program
  .command("databases")
  .description("Database operations");

databases
  .command("get <id>")
  .description("Get database schema and metadata")
  .action(async (id) => {
    try {
      const client = createClient();
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
  .requiredOption("--body <text>", "Comment text (use '-' to read from stdin)")
  .action(async (pageId, opts) => {
    try {
      const client = createClient();
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

program.parse();
