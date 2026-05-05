import { describe, it, expect, vi, afterEach } from "vitest";
import { buildAuthorizationUrl, exchangeCodeForToken, waitForOAuthCallback } from "../oauth.js";

describe("buildAuthorizationUrl", () => {
  it("returns correct Notion OAuth URL", () => {
    const url = buildAuthorizationUrl("client-id-123", "http://localhost:8765/callback");
    expect(url).toContain("https://api.notion.com/v1/oauth/authorize");
    expect(url).toContain("client_id=client-id-123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("owner=user");
    expect(url).toContain(encodeURIComponent("http://localhost:8765/callback"));
  });

  it("URL-encodes the redirect_uri", () => {
    const url = buildAuthorizationUrl("cid", "http://localhost:9000/cb");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:9000/cb");
  });
});

describe("exchangeCodeForToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exchanges code for token", async () => {
    const mockResponse = {
      access_token: "secret_abc",
      token_type: "bearer",
      bot_id: "bot-1",
      workspace_id: "ws-1",
      workspace_name: "Test WS",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const result = await exchangeCodeForToken("code-xyz", "client-id", "client-secret", "http://localhost:8765/callback");
    expect(result.access_token).toBe("secret_abc");
    expect(result.workspace_name).toBe("Test WS");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );

    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    expect(body.code).toBe("code-xyz");
    expect(body.grant_type).toBe("authorization_code");
    expect(body.redirect_uri).toBe("http://localhost:8765/callback");

    const auth = (callArgs.headers as Record<string, string>)["Authorization"];
    expect(auth).toMatch(/^Basic /);
    const decoded = Buffer.from(auth.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("client-id:client-secret");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_code",
    }));

    await expect(
      exchangeCodeForToken("bad-code", "cid", "cs", "http://localhost:8765/callback"),
    ).rejects.toThrow("Token exchange failed (400)");
  });
});

describe("waitForOAuthCallback", () => {
  it("resolves with auth code when callback receives ?code=xxx", async () => {
    const port = 47823; // use a specific test port
    const callbackPromise = waitForOAuthCallback(port);

    // Make a request to the callback server
    const res = await fetch(`http://localhost:${port}/callback?code=test-auth-code`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("認証成功");

    const code = await callbackPromise;
    expect(code).toBe("test-auth-code");
  });

  it("rejects when callback receives ?error=access_denied", async () => {
    const port = 47824;
    const callbackPromise = waitForOAuthCallback(port);

    const res = await fetch(`http://localhost:${port}/callback?error=access_denied`);
    expect(res.status).toBe(400);

    await expect(callbackPromise).rejects.toThrow("OAuth error: access_denied");
  });
});
