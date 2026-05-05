import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export interface OAuthConfig {
  type: "oauth";
  access_token: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
}

export interface TokenV2Config {
  type: "token_v2";
  token_v2: string;
}

export interface NotyConfig {
  auth?: OAuthConfig | TokenV2Config;
}

export type AuthType = "integration" | "oauth" | "token_v2" | "none";

export function getConfigDir(): string {
  return process.env.NOTY_CONFIG_DIR ?? join(homedir(), ".config", "noty");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function readConfig(): NotyConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as NotyConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: NotyConfig): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function clearAuthConfig(): void {
  const config = readConfig() ?? {};
  delete config.auth;
  writeConfig(config);
}

export function getOAuthToken(): string | null {
  const config = readConfig();
  if (config?.auth?.type === "oauth") {
    return config.auth.access_token;
  }
  return null;
}

export function getTokenV2(): string | null {
  const config = readConfig();
  if (config?.auth?.type === "token_v2") {
    return config.auth.token_v2;
  }
  return null;
}

export function getAuthType(): AuthType {
  if (process.env.NOTION_TOKEN) return "integration";
  const config = readConfig();
  if (config?.auth?.type === "oauth") return "oauth";
  if (config?.auth?.type === "token_v2") return "token_v2";
  return "none";
}
