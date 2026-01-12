import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
export interface DbListing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  brand: string;
  size: string;
  category: string;
  condition: string;
  colour: string | null;
  style: string | null;
  gender: string | null;
  price: number;
  shipping_price: number;
  images: string[];
  tags: string[];
  status: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  profiles?: {
    username: string;
    avatar_url: string | null;
    location: string | null;
    rating: number;
  } | null;
}

export interface ListingFilters {
  category?: string;
  size?: string;
  condition?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export const useListings = (filters?: ListingFilters) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100); // Limit to prevent DoS via large result sets

    // Exclude current user's own listings
    if (user) {
      query = query.neq('user_id', user.id);
    }

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category.toLowerCase());
    }
    if (filters?.size) {
      query = query.eq('size', filters.size.toLowerCase());
    }
    if (filters?.condition) {
      query = query.eq('condition', filters.condition.toLowerCase());
    }
    if (filters?.gender) {
      query = query.eq('gender', filters.gender.toLowerCase());
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setListings([]);
    } else if (data && data.length > 0) {
      // Get unique user_ids and fetch all profiles in a single query
      const uniqueUserIds = [...new Set(data.map(listing => listing.user_id))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, location, rating')
        .in('user_id', uniqueUserIds);
      
      // Create a map for quick profile lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );
      
      // Merge listings with profiles
      const listingsWithProfiles = data.map(listing => ({
        ...listing,
        profiles: profilesMap.get(listing.user_id) || null,
      }));
      
      setListings(listingsWithProfiles);
    } else {
      setListings([]);
    }
    setLoading(false);
  }, [user, filters?.category, filters?.size, filters?.condition, filters?.gender, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
};

export const useUserListings = (status?: 'active' | 'sold' | 'archived') => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setListings([]);
      setLoading(false);
      return;
    }

    const fetchUserListings = async () => {
      setLoading(true);
      let query = supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    };

    fetchUserListings();
  }, [user, status]);

  return { listings, loading };
};
