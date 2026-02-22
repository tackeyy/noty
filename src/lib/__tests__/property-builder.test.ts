import { describe, it, expect } from "vitest";
import { buildProperties } from "../property-builder.js";

describe("buildProperties", () => {
  it("converts Name string to title property", () => {
    const result = buildProperties({ Name: "Test Title" });
    expect(result.Name).toEqual({
      title: [{ text: { content: "Test Title" } }],
    });
  });

  it("converts array to multi_select", () => {
    const result = buildProperties({ Tags: ["tag1", "tag2"] });
    expect(result.Tags).toEqual({
      multi_select: [{ name: "tag1" }, { name: "tag2" }],
    });
  });

  it("converts string to rich_text", () => {
    const result = buildProperties({ Description: "Hello" });
    expect(result.Description).toEqual({
      rich_text: [{ text: { content: "Hello" } }],
    });
  });

  it("converts number to number property", () => {
    const result = buildProperties({ Score: 42 });
    expect(result.Score).toEqual({ number: 42 });
  });

  it("converts boolean to checkbox property", () => {
    const result = buildProperties({ Done: true });
    expect(result.Done).toEqual({ checkbox: true });
  });

  it("handles expanded date format", () => {
    const result = buildProperties({
      "date:開催日:start": "2026-01-01",
      "date:開催日:end": "2026-01-02",
    });
    expect(result["開催日"]).toEqual({
      date: { start: "2026-01-01", end: "2026-01-02" },
    });
  });

  it("passes through objects as-is", () => {
    const customProp = { select: { name: "Option A" } };
    const result = buildProperties({ Status: customProp });
    expect(result.Status).toEqual(customProp);
  });

  it("handles mixed properties", () => {
    const result = buildProperties({
      Name: "Page",
      Tags: ["a", "b"],
      "date:Due:start": "2026-03-01",
      Count: 5,
    });
    expect(Object.keys(result)).toHaveLength(4);
    expect(result.Name).toBeDefined();
    expect(result.Tags).toBeDefined();
    expect(result.Due).toBeDefined();
    expect(result.Count).toBeDefined();
  });
});
