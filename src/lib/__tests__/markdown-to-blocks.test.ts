import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "../markdown-to-blocks.js";

describe("markdownToBlocks", () => {
  it("converts heading 1", () => {
    const blocks = markdownToBlocks("# Title");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("heading_1");
  });

  it("converts heading 2", () => {
    const blocks = markdownToBlocks("## Subtitle");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("heading_2");
  });

  it("converts heading 3", () => {
    const blocks = markdownToBlocks("### Section");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("heading_3");
  });

  it("converts bulleted list", () => {
    const blocks = markdownToBlocks("- Item 1\n- Item 2");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("bulleted_list_item");
    expect(blocks[1].type).toBe("bulleted_list_item");
  });

  it("converts numbered list", () => {
    const blocks = markdownToBlocks("1. First\n2. Second");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("numbered_list_item");
    expect(blocks[1].type).toBe("numbered_list_item");
  });

  it("converts code block", () => {
    const blocks = markdownToBlocks("```typescript\nconst x = 1;\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("code");
    const code = blocks[0].code as any;
    expect(code.language).toBe("typescript");
    expect(code.rich_text[0].text.content).toBe("const x = 1;");
  });

  it("converts divider", () => {
    const blocks = markdownToBlocks("---");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("divider");
  });

  it("converts quote", () => {
    const blocks = markdownToBlocks("> Quoted text");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
  });

  it("converts paragraph (default)", () => {
    const blocks = markdownToBlocks("Just some text");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });

  it("skips empty lines", () => {
    const blocks = markdownToBlocks("Line 1\n\nLine 2");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("paragraph");
  });

  it("handles bold inline formatting", () => {
    const blocks = markdownToBlocks("This is **bold** text");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const boldPart = richText.find((rt: any) => rt.annotations.bold);
    expect(boldPart).toBeDefined();
    expect(boldPart.text.content).toBe("bold");
  });

  it("handles italic inline formatting", () => {
    const blocks = markdownToBlocks("This is *italic* text");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const italicPart = richText.find((rt: any) => rt.annotations.italic);
    expect(italicPart).toBeDefined();
    expect(italicPart.text.content).toBe("italic");
  });

  it("handles code inline formatting", () => {
    const blocks = markdownToBlocks("Use `code` here");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const codePart = richText.find((rt: any) => rt.annotations.code);
    expect(codePart).toBeDefined();
    expect(codePart.text.content).toBe("code");
  });

  it("handles links", () => {
    const blocks = markdownToBlocks("Click [here](https://example.com)");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const linkPart = richText.find((rt: any) => rt.text.link);
    expect(linkPart).toBeDefined();
    expect(linkPart.text.link.url).toBe("https://example.com");
  });

  it("handles strikethrough inline formatting", () => {
    const blocks = markdownToBlocks("This is ~~deleted~~ text");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const strikePart = richText.find((rt: any) => rt.annotations.strikethrough);
    expect(strikePart).toBeDefined();
    expect(strikePart.text.content).toBe("deleted");
  });

  it("handles bold+italic inline formatting", () => {
    const blocks = markdownToBlocks("This is ***important*** text");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    const part = richText.find(
      (rt: any) => rt.annotations.bold && rt.annotations.italic,
    );
    expect(part).toBeDefined();
    expect(part.text.content).toBe("important");
  });

  it("handles multiple inline formats in one line", () => {
    const blocks = markdownToBlocks("**bold** and *italic* and `code`");
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0].paragraph as any).rich_text;
    expect(richText.find((rt: any) => rt.annotations.bold)).toBeDefined();
    expect(richText.find((rt: any) => rt.annotations.italic)).toBeDefined();
    expect(richText.find((rt: any) => rt.annotations.code)).toBeDefined();
  });

  it("converts code block without language", () => {
    const blocks = markdownToBlocks("```\nsome code\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("code");
    const code = blocks[0].code as any;
    expect(code.language).toBe("plain text");
    expect(code.rich_text[0].text.content).toBe("some code");
  });

  it("converts bullet list with * marker", () => {
    const blocks = markdownToBlocks("* Item A\n* Item B");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("bulleted_list_item");
  });

  it("handles empty input", () => {
    const blocks = markdownToBlocks("");
    expect(blocks).toHaveLength(0);
  });

  it("handles complex document", () => {
    const md = `# Title

Some paragraph.

## Section

- Item 1
- Item 2

\`\`\`js
console.log("hello");
\`\`\`

---

> A quote`;

    const blocks = markdownToBlocks(md);
    const types = blocks.map((b) => b.type);
    expect(types).toEqual([
      "heading_1",
      "paragraph",
      "heading_2",
      "bulleted_list_item",
      "bulleted_list_item",
      "code",
      "divider",
      "quote",
    ]);
  });
});
