/**
 * Shared AI input validation & truncation helpers.
 *
 * Prevents oversized prompts from reaching Vertex AI,
 * guarding against cost spikes, timeouts, and abuse.
 */

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default limits — override per-function as needed */
export const AI_LIMITS = {
  /** Max items in any array included in a prompt */
  maxArrayItems: 20,
  /** Max characters for any individual string field */
  maxStringLength: 500,
  /** Max characters for the fully assembled prompt */
  maxPromptChars: 8_000,
  /** Max characters for JSON data blobs embedded in prompts */
  maxJsonChars: 50_000,
} as const;

// ---------------------------------------------------------------------------
// Truncation helpers
// ---------------------------------------------------------------------------

/**
 * Truncate an array to a maximum number of items.
 * Returns the first `maxItems` elements.
 */
export function truncateArray<T>(arr: T[], maxItems = AI_LIMITS.maxArrayItems): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems);
}

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 */
export function truncateString(str: string | null | undefined, maxLength = AI_LIMITS.maxStringLength): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Truncate a JSON-serializable object's string representation.
 * Returns the truncated JSON string.
 */
export function truncateJson(obj: unknown, maxChars = AI_LIMITS.maxJsonChars): string {
  const json = JSON.stringify(obj);
  if (json.length <= maxChars) return json;
  return json.slice(0, maxChars) + "\n... (truncated)";
}

/**
 * Validate and optionally truncate the assembled prompt.
 * Returns the prompt (possibly truncated) and whether it was truncated.
 */
export function enforcePromptLimit(
  prompt: string,
  maxChars = AI_LIMITS.maxPromptChars,
): { prompt: string; wasTruncated: boolean } {
  if (prompt.length <= maxChars) {
    return { prompt, wasTruncated: false };
  }
  return {
    prompt: prompt.slice(0, maxChars) + "\n\n[Content truncated due to size limits]",
    wasTruncated: true,
  };
}

/**
 * Truncate each string field in an array of objects.
 * Useful for arrays of records with text fields (e.g. decisions, reflections).
 */
export function truncateObjectStrings<T extends Record<string, unknown>>(
  items: T[],
  maxStringLen = AI_LIMITS.maxStringLength,
  maxItems = AI_LIMITS.maxArrayItems,
): T[] {
  return truncateArray(items, maxItems).map((item) => {
    const truncated = { ...item };
    for (const key of Object.keys(truncated)) {
      if (typeof truncated[key] === "string") {
        (truncated as Record<string, unknown>)[key] = truncateString(
          truncated[key] as string,
          maxStringLen,
        );
      }
    }
    return truncated;
  });
}
