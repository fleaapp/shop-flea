import { isSimilar } from './fuzzyMatch';

interface SearchableItem {
  title: string;
  description?: string | null;
  category: string;
  brand: string;
  colour?: string | null;
  style?: string | null;
  size: string;
  condition: string;
  tags?: string[] | null;
}

/**
 * Tokenizes a search query into individual lowercase words
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * High-signal fields (title, brand, category, tags) vs. low-signal (description, size, condition).
 * Fuzzy/typo matching is only ever applied to high-signal fields.
 */
function getSearchableFields(item: SearchableItem): { strong: string[]; weak: string[] } {
  const strong: string[] = [];
  const weak: string[] = [];

  if (item.title) strong.push(item.title.toLowerCase());
  if (item.brand) strong.push(item.brand.toLowerCase());
  if (item.category) strong.push(item.category.toLowerCase());
  if (item.colour) strong.push(item.colour.toLowerCase());
  if (item.style) strong.push(item.style.toLowerCase());
  if (item.tags) item.tags.forEach(tag => strong.push(tag.toLowerCase()));

  if (item.description) weak.push(item.description.toLowerCase());
  if (item.size) weak.push(item.size.toLowerCase());
  if (item.condition) weak.push(item.condition.toLowerCase());

  return { strong, weak };
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(field: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(token)}([^a-z0-9]|$)`, 'i').test(field);
}

function hasWordPrefix(field: string, token: string): boolean {
  return field.split(/[^a-z0-9]+/).some(word => word.length > 0 && word.startsWith(token));
}

/**
 * Levenshtein distance, capped for short strings.
 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Scores a single token against an item's fields.
 * Rules:
 * - Short tokens (< 4 chars) must match a whole word - no partials, no fuzzy.
 * - Medium tokens may match a word prefix.
 * - Only tokens of 5+ chars get typo tolerance, and only on strong fields.
 * - Description/size/condition only ever match on a whole word.
 */
function tokenMatchScore(token: string, fields: { strong: string[]; weak: string[] }): number {
  let best = 0;

  for (const field of fields.strong) {
    if (field === token) return 100;
    if (hasWholeWord(field, token)) best = Math.max(best, 90);
    else if (token.length >= 4 && hasWordPrefix(field, token)) best = Math.max(best, 70);
  }

  if (best === 0) {
    for (const field of fields.weak) {
      if (hasWholeWord(field, token)) best = Math.max(best, 55);
      else if (token.length >= 5 && hasWordPrefix(field, token)) best = Math.max(best, 45);
    }
  }

  // Typo tolerance: long tokens only, strong fields only.
  if (best === 0 && token.length >= 5) {
    for (const field of fields.strong) {
      const words = field.split(/[^a-z0-9]+/);
      for (const word of words) {
        if (word.length < 4) continue;
        const allowed = token.length >= 8 ? 2 : 1;
        if (editDistance(word, token) <= allowed) {
          best = Math.max(best, 40);
          break;
        }
      }
      if (best > 0) break;
    }
  }

  return best;
}

/**
 * Scores how well an item matches a search query.
 * Returns 0 if the item doesn't match, or a positive relevance score.
 * All tokens must match (AND); each token may match any field (OR).
 */
export function scoreSearchMatch(item: SearchableItem, query: string): number {
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) return 0;

  const fields = getSearchableFields(item);

  let totalScore = 0;

  for (const token of tokens) {
    const score = tokenMatchScore(token, fields);
    if (score === 0) return 0;
    totalScore += score;
  }

  return totalScore / tokens.length;
}

/** Minimum average relevance required for an item to be shown. */
const RELEVANCE_FLOOR = 40;


/**
 * Filters and sorts items by search relevance
 */
export function filterBySearch<T extends SearchableItem>(
  items: T[],
  query: string
): T[] {
  if (!query.trim()) return items;
  
  // Score all items
  const scored = items
    .map(item => ({
      item,
      score: scoreSearchMatch(item, query)
    }))
    .filter(({ score }) => score >= RELEVANCE_FLOOR);
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(({ item }) => item);
}
