import { isShoeCategory } from "@/config/sizeConfig";

export type SizeCategoryKey = "clothing" | "shoes";

export const makeSizeKey = (category: SizeCategoryKey, size: string) =>
  `${category}:${String(size ?? "")}`.toLowerCase();

export const parseSizeKey = (
  key: string
): { category: SizeCategoryKey; size: string } | null => {
  const raw = String(key ?? "").toLowerCase();
  const [cat, ...rest] = raw.split(":");

  if ((cat === "clothing" || cat === "shoes") && rest.length > 0) {
    return { category: cat, size: rest.join(":") };
  }
  return null;
};

/**
 * Normalizes legacy values (e.g. "8") to a key (defaulting to clothing) and
 * ensures the output is always lowercased.
 */
export const normalizeSizeKey = (
  key: string,
  defaultCategory: SizeCategoryKey = "clothing"
) => {
  const parsed = parseSizeKey(key);
  if (parsed) return makeSizeKey(parsed.category, parsed.size);
  return makeSizeKey(defaultCategory, key);
};

export const normalizeSizeKeys = (
  keys: string[] | null | undefined,
  defaultCategory: SizeCategoryKey = "clothing"
) => (keys ?? []).filter(Boolean).map((k) => normalizeSizeKey(k, defaultCategory));

export const getSizeValueFromKey = (key: string) => {
  const parsed = parseSizeKey(key);
  return (parsed ? parsed.size : String(key ?? "")).toLowerCase();
};

export const getQuerySizesFromKeys = (keys: string[]) =>
  Array.from(new Set(keys.map(getSizeValueFromKey)));

export const listingSizeKey = (listingSize: string, listingCategory: string) =>
  makeSizeKey(isShoeCategory(listingCategory) ? "shoes" : "clothing", listingSize);

export const formatSizeKeyLabel = (key: string) => {
  const parsed = parseSizeKey(key);
  if (!parsed) return String(key ?? "").toUpperCase();

  const sizeLabel = parsed.size.toUpperCase();
  return parsed.category === "shoes" ? `Shoes ${sizeLabel}` : sizeLabel;
};
