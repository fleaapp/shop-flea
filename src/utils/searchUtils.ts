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
 * Gets all searchable text fields from an item as lowercase strings
 */
function getSearchableFields(item: SearchableItem): string[] {
  const fields: string[] = [];
  
  // Add main text fields
  if (item.title) fields.push(item.title.toLowerCase());
  if (item.description) fields.push(item.description.toLowerCase());
  if (item.category) fields.push(item.category.toLowerCase());
  if (item.brand) fields.push(item.brand.toLowerCase());
  if (item.colour) fields.push(item.colour.toLowerCase());
  if (item.style) fields.push(item.style.toLowerCase());
  if (item.size) fields.push(item.size.toLowerCase());
  if (item.condition) fields.push(item.condition.toLowerCase());
  
  // Add individual tags
  if (item.tags) {
    item.tags.forEach(tag => fields.push(tag.toLowerCase()));
  }
  
  return fields;
}

/**
 * Checks if a single token matches any of the searchable fields
 * Returns a score indicating match quality (0 = no match, higher = better match)
 */
function tokenMatchScore(token: string, fields: string[]): number {
  let bestScore = 0;
  
  for (const field of fields) {
    // Exact match in field
    if (field === token) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }
    
    // Field contains token as a complete word
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
    if (wordBoundaryRegex.test(field)) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }
    
    // Field contains token (partial match)
    if (field.includes(token)) {
      bestScore = Math.max(bestScore, 70);
      continue;
    }
    
    // Token is a prefix of a word in the field (for partial typing like "snea" -> "sneakers")
    const words = field.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(token)) {
        bestScore = Math.max(bestScore, 60);
        break;
      }
    }
    
    // Fuzzy match (handles typos)
    if (isSimilar(field, token)) {
      bestScore = Math.max(bestScore, 40);
    }
  }
  
  return bestScore;
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scores how well an item matches a search query
 * Returns 0 if the item doesn't match, or a positive score indicating relevance
 * 
 * Matching logic:
 * - All tokens must match at least one field (AND between tokens)
 * - Each token can match any field (OR within a token)
 * - Word order doesn't matter
 * - Partial matches and fuzzy matching are supported
 */
export function scoreSearchMatch(item: SearchableItem, query: string): number {
  const tokens = tokenizeQuery(query);
  
  if (tokens.length === 0) return 0;
  
  const fields = getSearchableFields(item);
  
  let totalScore = 0;
  
  // Each token must match at least one field
  for (const token of tokens) {
    const score = tokenMatchScore(token, fields);
    
    // If any token doesn't match, the item doesn't match
    if (score === 0) {
      return 0;
    }
    
    totalScore += score;
  }
  
  // Normalize by number of tokens so longer queries don't automatically score higher
  return totalScore / tokens.length;
}

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
    .filter(({ score }) => score > 0);
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(({ item }) => item);
}
