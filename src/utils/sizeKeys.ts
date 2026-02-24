import { isShoeCategory } from "@/config/sizeConfig";

export type SizeCategoryKey = "clothing" | "shoes";
export type FitKey = "women" | "men" | "unisex";

/**
 * Creates a 3-part size key: fit:category:size
 * e.g. "women:clothing:m", "men:shoes:10"
 */
export const makeSizeKey = (fit: FitKey, category: SizeCategoryKey, size: string) =>
  `${fit}:${category}:${String(size ?? "")}`.toLowerCase();

/**
 * Legacy 2-part key creator (category:size) — only used internally for backward compat.
 */
export const makeLegacySizeKey = (category: SizeCategoryKey, size: string) =>
  `${category}:${String(size ?? "")}`.toLowerCase();

export const parseSizeKey = (
  key: string
): { fit: FitKey; category: SizeCategoryKey; size: string } | null => {
  const raw = String(key ?? "").toLowerCase();
  const parts = raw.split(":");

  // 3-part key: fit:category:size
  if (parts.length >= 3) {
    const [fit, cat, ...rest] = parts;
    if (
      (fit === "women" || fit === "men" || fit === "unisex") &&
      (cat === "clothing" || cat === "shoes") &&
      rest.length > 0
    ) {
      return { fit: fit as FitKey, category: cat as SizeCategoryKey, size: rest.join(":") };
    }
  }

  // 2-part legacy key: category:size (default fit to "women")
  if (parts.length === 2) {
    const [cat, ...rest] = parts;
    if ((cat === "clothing" || cat === "shoes") && rest.length > 0) {
      return { fit: "women", category: cat as SizeCategoryKey, size: rest.join(":") };
    }
  }

  return null;
};

/**
 * Normalizes legacy values (e.g. "8" or "clothing:8") to a 3-part key
 * and ensures the output is always lowercased.
 */
export const normalizeSizeKey = (
  key: string,
  defaultFit: FitKey = "women",
  defaultCategory: SizeCategoryKey = "clothing"
) => {
  const parsed = parseSizeKey(key);
  if (parsed) return makeSizeKey(parsed.fit, parsed.category, parsed.size);
  return makeSizeKey(defaultFit, defaultCategory, key);
};

export const normalizeSizeKeys = (
  keys: string[] | null | undefined,
  defaultFit: FitKey = "women",
  defaultCategory: SizeCategoryKey = "clothing"
) => (keys ?? []).filter(Boolean).map((k) => normalizeSizeKey(k, defaultFit, defaultCategory));

export const getSizeValueFromKey = (key: string) => {
  const parsed = parseSizeKey(key);
  return (parsed ? parsed.size : String(key ?? "")).toLowerCase();
};

export const getQuerySizesFromKeys = (keys: string[]) =>
  Array.from(new Set(keys.map(getSizeValueFromKey)));

export const listingSizeKey = (listingSize: string, listingCategory: string, listingGender: string | null) =>
  makeSizeKey(
    (listingGender?.toLowerCase() as FitKey) || "women",
    isShoeCategory(listingCategory) ? "shoes" : "clothing",
    listingSize
  );

export const formatSizeKeyLabel = (key: string) => {
  const parsed = parseSizeKey(key);
  if (!parsed) return String(key ?? "").toUpperCase();

  const sizeLabel = parsed.size.toUpperCase();
  const fitPrefix = parsed.fit === "women" ? "W" : parsed.fit === "men" ? "M" : "U";
  if (parsed.category === "shoes") return `${fitPrefix} Shoes ${sizeLabel}`;
  return `${fitPrefix} ${sizeLabel}`;
};
