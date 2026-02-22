/**
 * Extract a Notion page/database ID from various formats:
 * - Full URL: https://www.notion.so/workspace/Page-Title-abc123def456...
 * - UUID: abc123de-f456-7890-abcd-ef1234567890
 * - 32-char hex: abc123def4567890abcdef1234567890
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32_RE = /^[0-9a-f]{32}$/i;

export function extractNotionId(input: string): string {
  const trimmed = input.trim();

  // Already a standard UUID
  if (UUID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 32-char hex → convert to UUID
  if (HEX32_RE.test(trimmed)) {
    return toUuid(trimmed);
  }

  // URL format — extract the last 32-char hex segment
  try {
    const url = new URL(trimmed);
    const path = url.pathname;
    // Remove query params; the ID is the last 32 hex chars in the path
    const match = path.match(/([0-9a-f]{32})(?:[?#]|$)/i);
    if (match) {
      return toUuid(match[1]);
    }
    // Also try the pattern with hyphens at the end of the path
    const segments = path.split("/").pop() || "";
    const lastPart = segments.split("-").pop() || "";
    if (HEX32_RE.test(lastPart)) {
      return toUuid(lastPart);
    }
  } catch {
    // Not a URL, continue
  }

  // Try to find 32 hex chars anywhere in the string (e.g., "Page-Title-abc123...")
  const hexMatch = trimmed.match(/([0-9a-f]{32})/i);
  if (hexMatch) {
    return toUuid(hexMatch[1]);
  }

  // Return as-is if nothing matches (let the API return an error)
  return trimmed;
}

export function toUuid(hex32: string): string {
  const h = hex32.replace(/-/g, "").toLowerCase();
  if (h.length !== 32) return hex32;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
