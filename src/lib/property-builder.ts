/**
 * Convert flat property maps to Notion API format.
 *
 * Supports the expanded format used by the official Notion MCP:
 *   - "date:開催日:start" → date property start value
 *   - "date:開催日:is_datetime" → date property datetime flag
 *
 * And simple shorthand:
 *   - "Name" with string value → title
 *   - Array value → multi_select
 *   - String value → rich_text (default) or select
 */

type NotionPropertyValue = Record<string, unknown>;

interface DateAccumulator {
  start?: string;
  end?: string;
  is_datetime?: boolean;
}

export function buildProperties(
  flat: Record<string, unknown>,
): Record<string, NotionPropertyValue> {
  const result: Record<string, NotionPropertyValue> = {};
  const dateAccumulators: Record<string, DateAccumulator> = {};

  for (const [key, value] of Object.entries(flat)) {
    // Handle expanded date format: "date:PropertyName:field"
    const dateMatch = key.match(/^date:(.+):(.+)$/);
    if (dateMatch) {
      const [, propName, field] = dateMatch;
      if (!dateAccumulators[propName]) {
        dateAccumulators[propName] = {};
      }
      if (field === "start" || field === "end") {
        dateAccumulators[propName][field] = String(value);
      } else if (field === "is_datetime") {
        dateAccumulators[propName].is_datetime = Boolean(value);
      }
      continue;
    }

    // "Name" → title property
    if (key === "Name" && typeof value === "string") {
      result[key] = {
        title: [{ text: { content: value } }],
      };
      continue;
    }

    // Array → multi_select
    if (Array.isArray(value)) {
      result[key] = {
        multi_select: value.map((v) => ({ name: String(v) })),
      };
      continue;
    }

    // Number → number
    if (typeof value === "number") {
      result[key] = { number: value };
      continue;
    }

    // Boolean → checkbox
    if (typeof value === "boolean") {
      result[key] = { checkbox: value };
      continue;
    }

    // String → rich_text (default)
    if (typeof value === "string") {
      result[key] = {
        rich_text: [{ text: { content: value } }],
      };
      continue;
    }

    // Pass through objects as-is (already in Notion format)
    if (typeof value === "object" && value !== null) {
      result[key] = value as NotionPropertyValue;
    }
  }

  // Build date properties from accumulators
  for (const [propName, acc] of Object.entries(dateAccumulators)) {
    const date: Record<string, unknown> = {};
    if (acc.start) date.start = acc.start;
    if (acc.end) date.end = acc.end;
    result[propName] = { date };
  }

  return result;
}
