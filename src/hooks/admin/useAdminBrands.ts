import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { callAdminData } from './useAdminData';

export type AdminBrand = {
  id: string;
  brand_name: string;
  display_name: string;
  usage_count: number;
  created_at?: string;
};

export function useAdminBrands() {
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ brands: AdminBrand[] }>('listBrands', { search });
      setBrands(data.brands ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load brands.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const rename = async (id: string, display_name: string) => {
    try {
      await callAdminData('updateBrand', { id, display_name });
      toast.success('Brand updated.');
      await load();
    } catch (e: any) { toast.error(e?.message || 'Update failed.'); }
  };

  const remove = async (id: string) => {
    try {
      await callAdminData('deleteBrand', { id });
      toast.success('Brand deleted.');
      await load();
    } catch (e: any) { toast.error(e?.message || 'Delete failed.'); }
  };

  return { brands, loading, search, setSearch, rename, remove, refresh: load };
}
