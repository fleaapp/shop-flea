import { useState, useEffect, useCallback } from 'react';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

export interface Brand {
  id: string;
  brand_name: string;
  display_name: string;
  usage_count: number;
}

export const useBrands = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeCloudFunction('add-brand', { method: 'GET' });

      if (!error) {
        setBrands(((data as { brands?: Brand[] } | null)?.brands ?? []) as Brand[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const addBrand = useCallback(async (displayName: string): Promise<Brand | null> => {
    const trimmed = displayName.trim();
    if (!trimmed) return null;

    const normalized = trimmed.toLowerCase().replace(/[^\w\s&+'-]/g, '').replace(/\s+/g, ' ').trim();

    // Check for existing brand (case-insensitive)
    const existing = brands.find(b => b.brand_name === normalized);
    if (existing) return existing;

    const { data, error } = await invokeCloudFunction('add-brand', {
      displayName: trimmed,
    });

    if (error) {
      // Might be a unique constraint violation - try to fetch existing
      const { data: existingData } = await invokeCloudFunction('add-brand', {
        method: 'GET',
        query: { search: normalized },
      });
      const existingBrand = (existingData as { brands?: Brand[] } | null)?.brands?.find(
        brand => brand.brand_name === normalized
      );
      if (existingBrand) {
        setBrands(prev => {
          if (prev.find(b => b.id === existingBrand.id)) return prev;
          return [...prev, existingBrand].sort((a, b) =>
            a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
          );
        });
        return existingBrand;
      }
      return null;
    }

    const newBrand = (data as { brand?: Brand } | null)?.brand ?? (data as Brand);
    if (!newBrand?.id) return null;
    setBrands(prev => {
      const next = prev.some(brand => brand.id === newBrand.id) ? [...prev] : [...prev, newBrand];
      return next.sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
      );
    });
    return newBrand;
  }, [brands]);

  const searchBrands = useCallback((query: string): Brand[] => {
    if (!query.trim()) return brands;
    const q = query.toLowerCase().trim();
    return brands.filter(b =>
      b.brand_name.includes(q) || b.display_name.toLowerCase().includes(q)
    );
  }, [brands]);

  const findClosestMatch = useCallback((query: string): Brand | null => {
    const q = query.toLowerCase().trim();
    // Exact match
    const exact = brands.find(b => b.brand_name === q);
    if (exact) return exact;
    // Starts with
    const startsWith = brands.find(b => b.brand_name.startsWith(q));
    if (startsWith) return startsWith;
    return null;
  }, [brands]);

  const getBrandByName = useCallback((name: string): Brand | undefined => {
    const normalized = name.toLowerCase().trim();
    return brands.find(b => b.brand_name === normalized || b.display_name.toLowerCase() === normalized);
  }, [brands]);

  return { brands, loading, addBrand, searchBrands, findClosestMatch, getBrandByName, refetch: fetchBrands };
};
