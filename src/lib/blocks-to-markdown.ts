/**
 * Convert Notion Block objects to Markdown.
 */

type RichText = {
  type: string;
  text?: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
  plain_text?: string;
  href?: string;
};

type Block = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

export function richTextToMarkdown(richTexts: RichText[]): string {
  if (!richTexts || richTexts.length === 0) return "";

  return richTexts
    .map((rt) => {
      let text = rt.plain_text || rt.text?.content || "";
      if (!text) return "";

      const ann = rt.annotations;
      if (ann?.code) text = `\`${text}\``;
      if (ann?.bold) text = `**${text}**`;
      if (ann?.italic) text = `*${text}*`;
      if (ann?.strikethrough) text = `~~${text}~~`;

      // Links
      const href = rt.href || rt.text?.link?.url;
      if (href) {
        text = `[${text}](${href})`;
      }

      return text;
    })
    .join("");
}

function blockToMarkdown(block: Block, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  const type = block.type;
  const data = block[type] as Record<string, unknown> | undefined;
  if (!data) return "";

  switch (type) {
    case "paragraph":
      return `${prefix}${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "heading_1":
      return `${prefix}# ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "heading_2":
      return `${prefix}## ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "heading_3":
      return `${prefix}### ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "bulleted_list_item":
      return `${prefix}- ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "numbered_list_item":
      return `${prefix}1. ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "to_do": {
      const checked = (data.checked as boolean) ? "x" : " ";
      return `${prefix}- [${checked}] ${richTextToMarkdown(data.rich_text as RichText[])}`;
    }

    case "toggle":
      return `${prefix}- ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "code": {
      const lang = (data.language as string) || "";
      const code = richTextToMarkdown(data.rich_text as RichText[]);
      return `${prefix}\`\`\`${lang}\n${prefix}${code}\n${prefix}\`\`\``;
    }

    case "quote":
      return `${prefix}> ${richTextToMarkdown(data.rich_text as RichText[])}`;

    case "callout": {
      const icon = (data.icon as { emoji?: string })?.emoji || "";
      const text = richTextToMarkdown(data.rich_text as RichText[]);
      return `${prefix}> ${icon} ${text}`;
    }

    case "divider":
      return `${prefix}---`;

    case "image": {
      const imageData = data as {
        type: string;
        file?: { url: string };
        external?: { url: string };
        caption?: RichText[];
      };
      const url =
        imageData.type === "file"
          ? imageData.file?.url
          : imageData.external?.url;
      const caption = richTextToMarkdown(imageData.caption || []);
      return `${prefix}![${caption}](${url || ""})`;
    }

    case "table": {
      return ""; // Table rows are handled as children
    }

    case "table_row": {
      const cells = data.cells as RichText[][];
      if (!cells) return "";
      return (
        prefix +
        "| " +
        cells.map((cell) => richTextToMarkdown(cell)).join(" | ") +
        " |"
      );
    }

    case "bookmark": {
      const bookmarkUrl = (data.url as string) || "";
      const caption = richTextToMarkdown((data.caption as RichText[]) || []);
      return `${prefix}[${caption || bookmarkUrl}](${bookmarkUrl})`;
    }

    case "embed": {
      const embedUrl = (data.url as string) || "";
      return `${prefix}[${embedUrl}](${embedUrl})`;
    }

    case "equation": {
      const expr = (data.expression as string) || "";
      return `${prefix}$$${expr}$$`;
    }

    default:
      return "";
  }
}

export interface BlocksToMarkdownOptions {
  fetchChildren?: (blockId: string) => Promise<Block[]>;
}

export async function blocksToMarkdown(
  blocks: Block[],
  options?: BlocksToMarkdownOptions,
  indent: number = 0,
): Promise<string> {
  const lines: string[] = [];
  let isFirstTableRow = true;

  for (const block of blocks) {
    const line = blockToMarkdown(block, indent);

    // Handle table header separator
    if (block.type === "table_row") {
      lines.push(line);
      if (isFirstTableRow) {
        const cells = (block.table_row as { cells: RichText[][] })?.cells;
        if (cells) {
          const sep =
            "  ".repeat(indent) +
            "| " +
            cells.map(() => "---").join(" | ") +
            " |";
          lines.push(sep);
        }
        isFirstTableRow = false;
      }
    } else {
      isFirstTableRow = true;
      if (line) lines.push(line);
    }

    // Recursively fetch and convert children
    if (block.has_children && options?.fetchChildren) {
      const children = await options.fetchChildren(block.id);
      const childMd = await blocksToMarkdown(children, options, indent + 1);
      if (childMd) lines.push(childMd);
    }
  }

  return lines.join("\n");
}

export function blocksToMarkdownSync(
  blocks: Block[],
  indent: number = 0,
): string {
  const lines: string[] = [];
  let isFirstTableRow = true;

  for (const block of blocks) {
    const line = blockToMarkdown(block, indent);

    if (block.type === "table_row") {
      lines.push(line);
      if (isFirstTableRow) {
        const cells = (block.table_row as { cells: RichText[][] })?.cells;
        if (cells) {
          const sep =
            "  ".repeat(indent) +
            "| " +
            cells.map(() => "---").join(" | ") +
            " |";
          lines.push(sep);
        }
        isFirstTableRow = false;
      }
    } else {
      isFirstTableRow = true;
      if (line) lines.push(line);
    }
  }

  return lines.join("\n");
}
