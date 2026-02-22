import { describe, it, expect } from "vitest";
import { blocksToMarkdownSync, richTextToMarkdown } from "../blocks-to-markdown.js";

describe("richTextToMarkdown", () => {
  it("converts plain text", () => {
    expect(
      richTextToMarkdown([
        { type: "text", plain_text: "Hello", text: { content: "Hello" } },
      ]),
    ).toBe("Hello");
  });

  it("converts bold text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "bold",
          text: { content: "bold" },
          annotations: { bold: true },
        },
      ]),
    ).toBe("**bold**");
  });

  it("converts italic text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "italic",
          text: { content: "italic" },
          annotations: { italic: true },
        },
      ]),
    ).toBe("*italic*");
  });

  it("converts code text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "code",
          text: { content: "code" },
          annotations: { code: true },
        },
      ]),
    ).toBe("`code`");
  });

  it("converts strikethrough text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "deleted",
          text: { content: "deleted" },
          annotations: { strikethrough: true },
        },
      ]),
    ).toBe("~~deleted~~");
  });

  it("converts linked text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "click",
          text: { content: "click", link: { url: "https://example.com" } },
        },
      ]),
    ).toBe("[click](https://example.com)");
  });

  it("converts bold + italic text", () => {
    expect(
      richTextToMarkdown([
        {
          type: "text",
          plain_text: "important",
          text: { content: "important" },
          annotations: { bold: true, italic: true },
        },
      ]),
    ).toBe("***important***");
  });

  it("concatenates multiple rich text items", () => {
    expect(
      richTextToMarkdown([
        { type: "text", plain_text: "Hello ", text: { content: "Hello " } },
        {
          type: "text",
          plain_text: "world",
          text: { content: "world" },
          annotations: { bold: true },
        },
      ]),
    ).toBe("Hello **world**");
  });

  it("handles empty array", () => {
    expect(richTextToMarkdown([])).toBe("");
  });
});

describe("blocksToMarkdownSync", () => {
  it("converts paragraph", () => {
    const blocks = [
      {
        id: "1",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", plain_text: "Hello", text: { content: "Hello" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("Hello");
  });

  it("converts headings", () => {
    const blocks = [
      {
        id: "1",
        type: "heading_1",
        heading_1: { rich_text: [{ type: "text", plain_text: "H1", text: { content: "H1" } }] },
      },
      {
        id: "2",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", plain_text: "H2", text: { content: "H2" } }] },
      },
      {
        id: "3",
        type: "heading_3",
        heading_3: { rich_text: [{ type: "text", plain_text: "H3", text: { content: "H3" } }] },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("# H1\n## H2\n### H3");
  });

  it("converts bulleted list", () => {
    const blocks = [
      {
        id: "1",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", plain_text: "Item 1", text: { content: "Item 1" } }],
        },
      },
      {
        id: "2",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", plain_text: "Item 2", text: { content: "Item 2" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("- Item 1\n- Item 2");
  });

  it("converts numbered list", () => {
    const blocks = [
      {
        id: "1",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", plain_text: "First", text: { content: "First" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("1. First");
  });

  it("converts code block", () => {
    const blocks = [
      {
        id: "1",
        type: "code",
        code: {
          rich_text: [{ type: "text", plain_text: "const x = 1;", text: { content: "const x = 1;" } }],
          language: "typescript",
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("```typescript\nconst x = 1;\n```");
  });

  it("converts quote", () => {
    const blocks = [
      {
        id: "1",
        type: "quote",
        quote: {
          rich_text: [{ type: "text", plain_text: "Quoted text", text: { content: "Quoted text" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("> Quoted text");
  });

  it("converts callout with emoji", () => {
    const blocks = [
      {
        id: "1",
        type: "callout",
        callout: {
          rich_text: [{ type: "text", plain_text: "Important", text: { content: "Important" } }],
          icon: { emoji: "⚠️" },
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("> ⚠️ Important");
  });

  it("converts divider", () => {
    const blocks = [
      { id: "1", type: "divider", divider: {} },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("---");
  });

  it("converts to_do", () => {
    const blocks = [
      {
        id: "1",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", plain_text: "Task", text: { content: "Task" } }],
          checked: true,
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("- [x] Task");
  });

  it("converts image", () => {
    const blocks = [
      {
        id: "1",
        type: "image",
        image: {
          type: "external",
          external: { url: "https://example.com/img.png" },
          caption: [{ type: "text", plain_text: "Alt text", text: { content: "Alt text" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("![Alt text](https://example.com/img.png)");
  });

  it("converts unchecked to_do", () => {
    const blocks = [
      {
        id: "1",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", plain_text: "Task", text: { content: "Task" } }],
          checked: false,
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("- [ ] Task");
  });

  it("converts bookmark", () => {
    const blocks = [
      {
        id: "1",
        type: "bookmark",
        bookmark: {
          url: "https://example.com",
          caption: [{ type: "text", plain_text: "Example", text: { content: "Example" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("[Example](https://example.com)");
  });

  it("converts bookmark without caption", () => {
    const blocks = [
      {
        id: "1",
        type: "bookmark",
        bookmark: { url: "https://example.com", caption: [] },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("[https://example.com](https://example.com)");
  });

  it("converts equation", () => {
    const blocks = [
      {
        id: "1",
        type: "equation",
        equation: { expression: "E = mc^2" },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("$$E = mc^2$$");
  });

  it("converts toggle as bulleted list", () => {
    const blocks = [
      {
        id: "1",
        type: "toggle",
        toggle: {
          rich_text: [{ type: "text", plain_text: "Toggle", text: { content: "Toggle" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("- Toggle");
  });

  it("converts image with file type", () => {
    const blocks = [
      {
        id: "1",
        type: "image",
        image: {
          type: "file",
          file: { url: "https://s3.example.com/img.png" },
          caption: [],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("![](https://s3.example.com/img.png)");
  });

  it("handles empty blocks array", () => {
    expect(blocksToMarkdownSync([])).toBe("");
  });

  it("skips unknown block types", () => {
    const blocks = [
      { id: "1", type: "unknown_type", unknown_type: {} },
      {
        id: "2",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", plain_text: "Text", text: { content: "Text" } }],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe("Text");
  });

  it("converts table rows", () => {
    const blocks = [
      {
        id: "1",
        type: "table_row",
        table_row: {
          cells: [
            [{ type: "text", plain_text: "A", text: { content: "A" } }],
            [{ type: "text", plain_text: "B", text: { content: "B" } }],
          ],
        },
      },
      {
        id: "2",
        type: "table_row",
        table_row: {
          cells: [
            [{ type: "text", plain_text: "1", text: { content: "1" } }],
            [{ type: "text", plain_text: "2", text: { content: "2" } }],
          ],
        },
      },
    ];
    expect(blocksToMarkdownSync(blocks)).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    );
  });
});
