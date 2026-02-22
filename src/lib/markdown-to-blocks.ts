/**
 * Parse Markdown into Notion Block objects (line-based parser).
 */

type RichTextObject = {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

type NotionBlock = {
  object: "block";
  type: string;
  [key: string]: unknown;
};

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
};

function parseInlineFormatting(text: string): RichTextObject[] {
  const results: RichTextObject[] = [];

  // Regex to match markdown inline formatting
  // Order matters: bold+italic first, then bold, italic, strikethrough, code, links
  const pattern =
    /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\~\~([^~]+)\~\~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) {
        results.push({
          type: "text",
          text: { content: plain },
          annotations: { ...DEFAULT_ANNOTATIONS },
        });
      }
    }

    if (match[1]) {
      // Link: [text](url)
      results.push({
        type: "text",
        text: { content: match[2], link: { url: match[3] } },
        annotations: { ...DEFAULT_ANNOTATIONS },
      });
    } else if (match[4]) {
      // Code: `text`
      results.push({
        type: "text",
        text: { content: match[5] },
        annotations: { ...DEFAULT_ANNOTATIONS, code: true },
      });
    } else if (match[6]) {
      // Bold+Italic: ***text***
      results.push({
        type: "text",
        text: { content: match[7] },
        annotations: { ...DEFAULT_ANNOTATIONS, bold: true, italic: true },
      });
    } else if (match[8]) {
      // Bold: **text**
      results.push({
        type: "text",
        text: { content: match[9] },
        annotations: { ...DEFAULT_ANNOTATIONS, bold: true },
      });
    } else if (match[10]) {
      // Italic: *text*
      results.push({
        type: "text",
        text: { content: match[11] },
        annotations: { ...DEFAULT_ANNOTATIONS, italic: true },
      });
    } else if (match[12]) {
      // Strikethrough: ~~text~~
      results.push({
        type: "text",
        text: { content: match[13] },
        annotations: { ...DEFAULT_ANNOTATIONS, strikethrough: true },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      results.push({
        type: "text",
        text: { content: remaining },
        annotations: { ...DEFAULT_ANNOTATIONS },
      });
    }
  }

  // If no matches at all, return the whole text as plain
  if (results.length === 0 && text) {
    results.push({
      type: "text",
      text: { content: text },
      annotations: { ...DEFAULT_ANNOTATIONS },
    });
  }

  return results;
}

function makeRichText(text: string): RichTextObject[] {
  return parseInlineFormatting(text);
}

export function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split("\n");
  const blocks: NotionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const lang = codeMatch[1] || "plain text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [
            {
              type: "text",
              text: { content: codeLines.join("\n") },
              annotations: { ...DEFAULT_ANNOTATIONS },
            },
          ],
          language: lang,
        },
      });
      continue;
    }

    // Divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: "block", type: "divider", divider: {} });
      i++;
      continue;
    }

    // Headings
    const h1Match = line.match(/^# (.+)$/);
    if (h1Match) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: makeRichText(h1Match[1]) },
      });
      i++;
      continue;
    }

    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: makeRichText(h2Match[1]) },
      });
      i++;
      continue;
    }

    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: makeRichText(h3Match[1]) },
      });
      i++;
      continue;
    }

    // Bulleted list
    const bulletMatch = line.match(/^[-*] (.+)$/);
    if (bulletMatch) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: makeRichText(bulletMatch[1]) },
      });
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\d+\. (.+)$/);
    if (numMatch) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: makeRichText(numMatch[1]) },
      });
      i++;
      continue;
    }

    // Quote
    const quoteMatch = line.match(/^> (.+)$/);
    if (quoteMatch) {
      blocks.push({
        object: "block",
        type: "quote",
        quote: { rich_text: makeRichText(quoteMatch[1]) },
      });
      i++;
      continue;
    }

    // Empty line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (default)
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: makeRichText(line) },
    });
    i++;
  }

  return blocks;
}
