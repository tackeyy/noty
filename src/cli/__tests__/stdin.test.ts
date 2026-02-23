import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

// Import the function we'll test
// We test readStdin by importing it directly
let readStdin: () => Promise<string>;

beforeEach(async () => {
  // Dynamic import to get the module fresh
  const mod = await import("../stdin.js");
  readStdin = mod.readStdin;
});

describe("readStdin", () => {
  let originalStdin: typeof process.stdin;

  beforeEach(() => {
    originalStdin = process.stdin;
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin });
  });

  it("returns empty string when stdin is TTY", async () => {
    const mockStdin = new Readable({ read() {} }) as any;
    mockStdin.isTTY = true;
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const result = await readStdin();
    expect(result).toBe("");
  });

  it("reads piped input correctly", async () => {
    const mockStdin = new Readable({
      read() {
        this.push("hello from pipe");
        this.push(null);
      },
    }) as any;
    mockStdin.isTTY = false;
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const result = await readStdin();
    expect(result).toBe("hello from pipe");
  });

  it("preserves multiline Markdown newlines", async () => {
    const multilineContent = "# Title\n\nParagraph 1\n\n- item 1\n- item 2\n";
    const mockStdin = new Readable({
      read() {
        this.push(multilineContent);
        this.push(null);
      },
    }) as any;
    mockStdin.isTTY = false;
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const result = await readStdin();
    expect(result).toBe("# Title\n\nParagraph 1\n\n- item 1\n- item 2");
  });

  it("handles multiple chunks", async () => {
    const mockStdin = new Readable({
      read() {
        this.push("chunk1");
        this.push("chunk2");
        this.push("chunk3");
        this.push(null);
      },
    }) as any;
    mockStdin.isTTY = false;
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const result = await readStdin();
    expect(result).toBe("chunk1chunk2chunk3");
  });
});
