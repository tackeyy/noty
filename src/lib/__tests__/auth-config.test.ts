import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readConfig,
  writeConfig,
  clearAuthConfig,
  getOAuthToken,
  getAuthType,
  type OAuthConfig,
} from "../auth-config.js";

const TEST_DIR = join(tmpdir(), `noty-test-auth-config-${process.pid}`);

describe("auth-config", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.NOTY_CONFIG_DIR = TEST_DIR;
    delete process.env.NOTION_TOKEN;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.NOTY_CONFIG_DIR;
  });

  describe("readConfig", () => {
    it("returns null when config file does not exist", () => {
      expect(readConfig()).toBeNull();
    });

    it("reads existing config", () => {
      const auth: OAuthConfig = {
        type: "oauth",
        access_token: "token-abc",
        bot_id: "bot-1",
        workspace_id: "ws-1",
        workspace_name: "WS",
      };
      writeFileSync(join(TEST_DIR, "config.json"), JSON.stringify({ auth }));
      const config = readConfig();
      expect(config?.auth?.access_token).toBe("token-abc");
    });

    it("returns null for invalid JSON", () => {
      writeFileSync(join(TEST_DIR, "config.json"), "invalid json{");
      expect(readConfig()).toBeNull();
    });
  });

  describe("writeConfig", () => {
    it("writes config to file", () => {
      const auth: OAuthConfig = {
        type: "oauth",
        access_token: "secret-token",
        bot_id: "bot-2",
        workspace_id: "ws-2",
        workspace_name: "My WS",
      };
      writeConfig({ auth });
      const config = readConfig();
      expect(config?.auth?.access_token).toBe("secret-token");
      expect(config?.auth?.workspace_name).toBe("My WS");
    });

    it("creates parent directories if needed", () => {
      const nestedDir = join(TEST_DIR, "sub", "nested");
      process.env.NOTY_CONFIG_DIR = nestedDir;
      writeConfig({ auth: { type: "oauth", access_token: "t", bot_id: "b", workspace_id: "w", workspace_name: "n" } });
      const config = readConfig();
      expect(config?.auth?.access_token).toBe("t");
    });
  });

  describe("clearAuthConfig", () => {
    it("removes auth from config", () => {
      writeConfig({
        auth: { type: "oauth", access_token: "tok", bot_id: "b", workspace_id: "w", workspace_name: "n" },
      });
      clearAuthConfig();
      const config = readConfig();
      expect(config?.auth).toBeUndefined();
    });

    it("is a no-op when no config exists", () => {
      expect(() => clearAuthConfig()).not.toThrow();
    });
  });

  describe("getOAuthToken", () => {
    it("returns null when no config exists", () => {
      expect(getOAuthToken()).toBeNull();
    });

    it("returns access_token when oauth config exists", () => {
      writeConfig({
        auth: { type: "oauth", access_token: "my-oauth-token", bot_id: "b", workspace_id: "w", workspace_name: "n" },
      });
      expect(getOAuthToken()).toBe("my-oauth-token");
    });

    it("returns null after clearAuthConfig", () => {
      writeConfig({
        auth: { type: "oauth", access_token: "tok", bot_id: "b", workspace_id: "w", workspace_name: "n" },
      });
      clearAuthConfig();
      expect(getOAuthToken()).toBeNull();
    });
  });

  describe("getAuthType", () => {
    it("returns 'none' when no auth configured", () => {
      expect(getAuthType()).toBe("none");
    });

    it("returns 'integration' when NOTION_TOKEN is set", () => {
      process.env.NOTION_TOKEN = "secret_integration_token";
      expect(getAuthType()).toBe("integration");
    });

    it("returns 'oauth' when oauth config exists and no NOTION_TOKEN", () => {
      writeConfig({
        auth: { type: "oauth", access_token: "tok", bot_id: "b", workspace_id: "w", workspace_name: "n" },
      });
      expect(getAuthType()).toBe("oauth");
    });

    it("returns 'integration' when both NOTION_TOKEN and oauth config exist", () => {
      process.env.NOTION_TOKEN = "integration_token";
      writeConfig({
        auth: { type: "oauth", access_token: "oauth_token", bot_id: "b", workspace_id: "w", workspace_name: "n" },
      });
      expect(getAuthType()).toBe("integration");
    });
  });
});
