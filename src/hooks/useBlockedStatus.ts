import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useBlockedStatus = () => {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsBlocked(false);
      setLoading(false);
      return;
    }

    const checkBlockedStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setIsBlocked(data.status === 'blocked');
      }
      setLoading(false);
    };

    checkBlockedStatus();

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'status' in payload.new) {
            setIsBlocked(payload.new.status === 'blocked');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { isBlocked, loading };
};
