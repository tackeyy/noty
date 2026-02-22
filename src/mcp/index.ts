#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NotyClient } from "../lib/client.js";
import { createNotyMcpServer } from "./server.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("Error: NOTION_TOKEN environment variable is required");
  process.exit(1);
}

const client = new NotyClient({ token });
const server = createNotyMcpServer(client);

const transport = new StdioServerTransport();
await server.connect(transport);
