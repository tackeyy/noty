import { createServer } from "node:http";

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
}

export function buildAuthorizationUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<OAuthTokenResponse>;
}

/** Starts a local HTTP server on `port` and resolves with the OAuth `code` when Notion redirects back. */
export function waitForOAuthCallback(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><h1>認証成功！</h1><p>このタブを閉じて CLI に戻ってください。</p></body></html>",
        );
        server.close();
        resolve(code);
      } else {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<html><body><h1>認証エラー</h1><p>${error ?? "unknown error"}</p></body></html>`,
        );
        server.close();
        reject(new Error(`OAuth error: ${error ?? "unknown"}`));
      }
    });

    server.on("error", (err) => reject(err));
    server.listen(port);
  });
}

/** Finds a free TCP port by binding to port 0. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}
