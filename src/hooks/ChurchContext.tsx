import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ChurchContext = createContext(null);

export function ChurchProvider({ children }) {
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { session, user } = useAuth(); 
  const userId = user?.id || session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setChurch(null);
      setLoading(false);
      return;
    }

    async function fetchUserChurch() {
      const { data, error } = await supabase
        .from('church_members')
        .select(`
          church_id,
          churches ( name )
        `)
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (!error && data) {
        setChurch({
          id: data.church_id,
          name: data.churches?.name
        });
      }
      setLoading(false);
    }

    fetchUserChurch();
  }, [userId]);

  return (
    <ChurchContext.Provider value={{ church, loading }}>
      {children}
    </ChurchContext.Provider>
  );
}

export function useChurch() {
  return useContext(ChurchContext);
}