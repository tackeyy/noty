import { describe, it, expect, vi } from "vitest";
import { createClientFromEnv, NotyClient } from "../client.js";
import { InternalNotionClient } from "../internal-client.js";

describe("createClientFromEnv", () => {
  it("returns NotyClient when integration token is available", () => {
    const client = createClientFromEnv({
      getIntegrationToken: () => "int-token",
      getTokenV2: () => null,
    });
    expect(client).toBeInstanceOf(NotyClient);
  });

  it("returns InternalNotionClient when token_v2 is available", () => {
    const client = createClientFromEnv({
      getIntegrationToken: () => null,
      getTokenV2: () => "cookie-token",
      fetchImpl: vi.fn(),
    });
    expect(client).toBeInstanceOf(InternalNotionClient);
  });

  it("throws when no auth exists", () => {
    expect(() =>
      createClientFromEnv({
        getIntegrationToken: () => null,
        getTokenV2: () => null,
      }),
    ).toThrow("No authentication configured");
  });
});
