import { describe, it, expect } from "vitest";
import { extractNotionId, toUuid } from "../url-parser.js";

describe("toUuid", () => {
  it("converts 32-char hex to UUID format", () => {
    expect(toUuid("abc123def4567890abcdef1234567890")).toBe(
      "abc123de-f456-7890-abcd-ef1234567890",
    );
  });

  it("returns input as-is if not 32 chars", () => {
    expect(toUuid("short")).toBe("short");
  });
});

describe("extractNotionId", () => {
  it("returns a standard UUID as-is (lowercased)", () => {
    expect(extractNotionId("abc123de-f456-7890-abcd-ef1234567890")).toBe(
      "abc123de-f456-7890-abcd-ef1234567890",
    );
  });

  it("converts 32-char hex to UUID", () => {
    expect(extractNotionId("abc123def4567890abcdef1234567890")).toBe(
      "abc123de-f456-7890-abcd-ef1234567890",
    );
  });

  it("extracts ID from Notion URL", () => {
    expect(
      extractNotionId(
        "https://www.notion.so/workspace/Page-Title-abc123def4567890abcdef1234567890",
      ),
    ).toBe("abc123de-f456-7890-abcd-ef1234567890");
  });

  it("extracts ID from Notion URL with query params", () => {
    expect(
      extractNotionId(
        "https://notion.so/abc123def4567890abcdef1234567890?v=xxx",
      ),
    ).toBe("abc123de-f456-7890-abcd-ef1234567890");
  });

  it("returns input as-is if nothing matches", () => {
    expect(extractNotionId("not-a-valid-id")).toBe("not-a-valid-id");
  });

  it("handles whitespace", () => {
    expect(extractNotionId("  abc123def4567890abcdef1234567890  ")).toBe(
      "abc123de-f456-7890-abcd-ef1234567890",
    );
  });
});
