# noty

Notion CLI tool and library for TypeScript.

## Features

- **CLI** — Search, read, create, and update Notion pages from the terminal
- **Library** — Import `NotyClient` for programmatic access to Notion
- **Markdown I/O** — Read pages as Markdown, write Markdown that becomes Notion blocks
- **Three output formats** — Human-readable, JSON, and TSV (plain)
- **stdin support** — Pipe content via `--content -`, `--properties -`, `--body -`
- **Retry with backoff** — Automatic retry on 429/5xx with exponential backoff

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

### Environment variables

| Variable | Description |
|----------|-------------|
| `NOTION_TOKEN` | Integration Token (official API, requires integration setup) |
| `NOTION_TOKEN_V2` | Browser session cookie token (no integration needed, see below) |

**Authentication priority:** `NOTION_TOKEN` → OAuth config → `NOTION_TOKEN_V2` → saved `set-cookie` config → error

### Alternative: Use browser session token (token_v2)

If you want to access your own private pages without registering a Notion integration, you can use your browser session cookie (`token_v2`).

**Option A — environment variable (recommended for scripts):**

```bash
export NOTION_TOKEN_V2="<token_v2-value>"
```

**Option B — saved config (recommended for interactive use):**

1. Open [notion.so](https://www.notion.so) in your browser and log in
2. Open DevTools → **Application** → **Cookies** → find `token_v2` and copy its value
3. Run:

```bash
noty auth set-cookie <paste-token_v2-here>
```

Check status and manage authentication:

```bash
noty auth status           # Show current auth type
noty auth logout           # Remove saved token
```

> **Note:** The `token_v2` cookie expires when you log out of Notion in the browser. Re-run `noty auth set-cookie` (or re-export `NOTION_TOKEN_V2`) if authentication stops working.

## CLI Commands

```
noty auth test                         # Test authentication
noty auth set-cookie <token_v2>        # Save browser session token (no integration needed)
noty auth login                        # Authenticate via Notion OAuth (requires integration)
noty auth status                       # Show current authentication status
noty auth logout                       # Remove saved OAuth/token_v2 credential
noty search [query]                    # Search pages and databases
  --filter <type>                      #   Filter by type (page or database)
  --limit <n>                          #   Maximum results (default: 10)
  --sort <direction>                   #   Sort by last_edited_time (ascending or descending)
  --all                                #   Fetch all results with cursor pagination
                                       #   (query 省略で integration がアクセス可能な全ページ・DB を列挙)
noty pages get <id>                    # Get page content as Markdown
noty pages create                      # Create a new page
  --parent <id>                        #   Parent page or database ID (required)
  --title <title>                      #   Page title
  --content <md>                       #   Content as Markdown (use '-' for stdin)
  --properties <json>                  #   Properties as JSON (use '-' for stdin)
noty pages update <id>                 # Update a page
  --title <title>                      #   New page title
  --content <md>                       #   New content as Markdown (use '-' for stdin)
  --properties <json>                  #   Properties as JSON (use '-' for stdin)
  --append                             #   Append content instead of replacing
noty databases get <id>                # Get database schema and metadata
noty databases query <id>              # Query a database
  --filter <json>                      #   Filter as JSON string
  --sorts <json>                       #   Sorts as JSON string
  --limit <n>                          #   Maximum results (default: 100)
noty comments list <page_id>           # List page comments
noty comments add <page_id>            # Add a comment to a page
  --body <text>                        #   Comment text (use '-' for stdin)
noty users list                        # List workspace users
noty files upload <file_path>          # Upload a local file to Notion (Direct Upload)
noty pages attach-file <page_id> <file_path>  # Upload and attach file as a block to a page
  --caption <text>                     #   Caption text for the file block
```

### Output Formats

| Flag | Format | Use case |
|------|--------|----------|
| (none) | Human-readable | Interactive terminal use |
| `--json` | JSON | Piping to jq, scripts |
| `--plain` | TSV | Unix pipelines, awk/cut |

### stdin Examples

Pipe long Markdown content:

```bash
cat meeting-notes.md | noty pages create --parent <id> --title "Meeting Notes" --content -
```

Pipe JSON properties:

```bash
echo '{"名前":{"title":[{"text":{"content":"New Entry"}}]}}' | noty pages create --parent <db-id> --properties -
```

Append content to existing page:

```bash
echo "## New Section\n\nAppended content" | noty pages update <page-id> --content - --append
```

## Library Usage

```typescript
import { NotyClient } from "noty";

const client = new NotyClient({ token: process.env.NOTION_TOKEN! });

// Search
const results = await client.search("meeting notes");

// Search with sort
const sorted = await client.search("notes", {
  sort: { direction: "descending", timestamp: "last_edited_time" },
});

// Read a page as Markdown
const markdown = await client.getPage("page-id-or-url");

// Create a page
const page = await client.createPage({
  parentId: "parent-page-id",
  title: "New Page",
  content: "# Hello\n\nWorld",
});

// Update a page (append mode)
await client.updatePage("page-id", {
  content: "## New Section",
  mode: "append",
});

// Get database schema
const db = await client.getDatabase("db-id");

// Query a database
const rows = await client.queryDatabase("db-id", {
  filter: { property: "Status", select: { equals: "Done" } },
});
```

### File Upload

Upload a file and attach it to a Notion page:

```typescript
import { NotyClient } from "noty";

const client = new NotyClient({ token: process.env.NOTION_TOKEN! });

// Upload a file (returns file_upload_id)
const upload = await client.uploadFile("/path/to/report.pdf");
console.log(upload.id);     // file_upload_id
console.log(upload.status); // "uploaded"

// Upload and attach as a file block to a page
const page = await client.attachFileToPage("page-id", "/path/to/report.pdf", {
  caption: "Q1 Report",
});
```

> **Note:** File upload requires `NOTION_TOKEN` (integration token). It is not supported with `NOTION_TOKEN_V2` (browser cookie).
> Maximum file size: 5 MB (single-part upload).

### Retry

All API calls automatically retry on 429 (rate limit) and 5xx (server error) with exponential backoff. You can also use `withRetry` directly:

```typescript
import { withRetry } from "noty";

const result = await withRetry(() => someApiCall(), {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
});
```

## License

MIT
