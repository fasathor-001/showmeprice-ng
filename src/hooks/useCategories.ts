
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Category } from '../types';
import { MOCK_CATEGORIES } from '../constants';

export function useHubs() {
  const [hubs, setHubs] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHubs() {
      // 1. Try fetching from Supabase if configured
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .order('sort_order');

          if (data && data.length > 0) {
            setHubs(data);
            setLoading(false);
            return;
          }
          if (error) throw error;
        } catch (err: any) {
          console.warn('Supabase category fetch failed (using static list):', err.message);
        }
      }

      // 2. Fallback to Static Data (Config)
      // Ensures homepage grid is populated even without DB connection
      setHubs(MOCK_CATEGORIES);
      setLoading(false);
    }

    fetchHubs();
  }, []);

  return { hubs, loading, error };
}

export function useSubcategories(hubId: number | string | null) {
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubcategories() {
      if (!hubId) {
        setSubcategories([]);
        return;
      }

      setLoading(true);
      try {
        if (supabase) {
            const { data, error } = await supabase
              .from('categories')
              .select('*')
              .eq('parent_id', hubId)
              .order('sort_order');

            if (error) throw error;
            setSubcategories(data || []);
        } else {
            // No static fallback for subcategories currently
            setSubcategories([]);
        }
      } catch (err: any) {
        console.error('Error fetching subcategories:', err);
        setError(err.message);
        setSubcategories([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSubcategories();
  }, [hubId]);

  return { subcategories, loading, error };
}
