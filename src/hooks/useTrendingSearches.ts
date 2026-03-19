 import { useState, useEffect } from 'react';
 import { supabase } from '@/lib/supabase';
 
 interface TrendingSearch {
   query: string;
   search_count: number;
 }
 
export function useTrendingSearches() {
   const [trending, setTrending] = useState<TrendingSearch[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchTrending = async () => {
     try {
        const { data, error } = await supabase.rpc('get_trending_searches', {
          limit_count: 10
        });
       
       if (error) {
         console.error('Error fetching trending searches:', error);
         return;
       }
       
       setTrending(data || []);
     } catch (err) {
       console.error('Failed to fetch trending searches:', err);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchTrending();
   }, []);
 
   const recordSearch = async (query: string, userId?: string) => {
     if (!query.trim()) return;
     
     try {
       await supabase.from('search_queries').insert({
         query: query.trim().toLowerCase(),
         user_id: userId || null
       });
     } catch (err) {
       // Silent fail - don't block user experience
       console.error('Failed to record search:', err);
     }
   };
 
   return { trending, loading, recordSearch };
 }