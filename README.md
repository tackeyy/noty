# noty

Notion CLI tool, library, and MCP server for TypeScript.

## Features

- **CLI** — Search, read, create, and update Notion pages from the terminal
- **Library** — Import `NotyClient` for programmatic access to Notion
- **MCP Server** — Expose Notion operations as Model Context Protocol tools for AI agents
- **Markdown I/O** — Read pages as Markdown, write Markdown that becomes Notion blocks
- **Three output formats** — Human-readable, JSON, and TSV (plain)

## Installation

```bash
npm install noty
```

Or install globally for CLI usage:

```bash
npm install -g noty
```

## Setup

### 1. Create a Notion Internal Integration

1. Go to [My Integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Name it (e.g., "noty") and select a workspace
4. Copy the **Internal Integration Secret**

### 2. Share pages with your integration

In Notion, open any page or database you want noty to access, click **...** > **Connections** > add your integration.

### 3. Set the environment variable

```bash
export NOTION_TOKEN="ntn_..."
```

## CLI Commands

```
noty auth test                         # Test authentication
noty search <query>                    # Search pages and databases
noty pages get <id>                    # Get page content as Markdown
noty pages create --parent <id> --title <t> [--content <md>] [--properties <json>]
noty pages update <id> [--title <t>] [--content <md>] [--properties <json>]
noty databases query <id> [--filter <json>] [--sorts <json>]
noty comments list <page_id>           # List page comments
noty comments add <page_id> --body <text>
noty users list                        # List workspace users
noty mcp                               # Start MCP server (stdio)
```

### Output Formats

| Flag | Format | Use case |
|------|--------|----------|
| (none) | Human-readable | Interactive terminal use |
| `--json` | JSON | Piping to jq, scripts |
| `--plain` | TSV | Unix pipelines, awk/cut |

## Library Usage

```typescript
import { NotyClient } from "noty";

const client = new NotyClient({ token: process.env.NOTION_TOKEN! });

// Search
const results = await client.search("meeting notes");

// Read a page as Markdown
const markdown = await client.getPage("page-id-or-url");

// Create a page
const page = await client.createPage({
  parentId: "parent-page-id",
  title: "New Page",
  content: "# Hello\n\nWorld",
});

// Query a database
const rows = await client.queryDatabase("db-id", {
  filter: { property: "Status", select: { equals: "Done" } },
});
```

## MCP Server

### Claude Code

Add to your Claude Code settings (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["noty", "mcp"],
      "env": { "NOTION_TOKEN": "ntn_..." }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["noty", "mcp"],
      "env": { "NOTION_TOKEN": "ntn_..." }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `notion-search` | Search pages and databases |
| `notion-fetch` | Fetch page content as Markdown |
| `notion-create-pages` | Create pages |
| `notion-update-page` | Update page properties and content |
| `notion-get-comments` | List page comments |
| `notion-create-comment` | Add a comment |
| `notion-get-users` | List workspace users |
| `notion-get-teams` | List workspace teams |

## License

MIT
