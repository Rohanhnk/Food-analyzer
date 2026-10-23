/**
 * Text normalization utilities for food queries and alias matching.
 */

/** Normalizes case, removes accents/diacritics, strips punctuation and collapses whitespace. */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[/\\_,\-()[\]{}!?:;."']/g, " ") // replace punctuation with spaces
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits text into unique non-empty normalized word tokens. */
export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(" ").filter(t => t.length > 0);
}

/** Computes token-level Jaccard overlap between query tokens and target tokens. */
export function tokenOverlapRatio(queryTokens: string[], targetTokens: string[]): number {
  if (!queryTokens.length || !targetTokens.length) return 0;
  const targetSet = new Set(targetTokens);
  let overlap = 0;
  for (const q of queryTokens) {
    if (targetSet.has(q)) {
      overlap++;
    }
  }
  return overlap / queryTokens.length;
}
