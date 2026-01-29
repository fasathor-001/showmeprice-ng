import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { Institution, ProcurementLog } from '../types';

function isMissingTableError(err: any) {
  const code = String(err?.code ?? '');
  const status = Number(err?.status ?? 0);
  const message = String(err?.message ?? '');
  return code === 'PGRST205' || status === 404 || message.includes('PGRST205');
}

export function useInstitution() {
  const { user } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [logs, setLogs] = useState<ProcurementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Institution Profile
  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    async function fetchInstitution() {
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('user_id', user!.id)
          .limit(1);

        if (error) {
          if (isMissingTableError(error)) {
            setInstitution(null);
            setLogs([]);
            return;
          }
          setError(error.message);
          return;
        }

        const raw = (data && data.length > 0) ? (data[0] as any) : null;
        const inst = raw
          ? ({
              ...raw,
              org_name: raw.org_name ?? raw.institution_name,
              org_type: raw.org_type ?? raw.institution_type,
            } as Institution)
          : null;

        if (inst) {
          setInstitution(inst);
          fetchLogs(inst.id);
        } else {
          setInstitution(null);
        }
      } catch (err: any) {
        if (!isMissingTableError(err)) {
          setError(err?.message ?? 'Failed to load institution.');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchInstitution();
  }, [user]);

  // Fetch Logs
  const fetchLogs = async (instId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('procurement_logs')
      .select('*, products(title, images)')
      .eq('institution_id', instId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data as ProcurementLog[]);
    }
  };

  // Create Institution
  const createInstitution = async (name: string, type: string, _address: string) => {
    void _address;
    if (!user || !supabase) return false;
    try {
      const { data, error } = await supabase
        .from('institutions')
        .insert({
          user_id: user.id,
          institution_name: name,
          institution_type: type
        })
        .select()
        .limit(1);

      if (error) throw error;

      const createdRaw = (data && data.length > 0) ? (data[0] as any) : null;
      const created = createdRaw
        ? ({
            ...createdRaw,
            org_name: createdRaw.org_name ?? createdRaw.institution_name,
            org_type: createdRaw.org_type ?? createdRaw.institution_type,
          } as Institution)
        : null;
      setInstitution(created);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Add Item to Log
  const addToProcurement = async (item: { productId?: string, name: string, price: number, qty: number }) => {
    if (!institution || !supabase) return false;
    try {
      const { error } = await supabase
        .from('procurement_logs')
        .insert({
          institution_id: institution.id,
          product_id: item.productId,
          custom_item_name: item.name,
          unit_price: item.price,
          quantity: item.qty,
          status: 'planned'
        });

      if (error) throw error;
      await fetchLogs(institution.id);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Update Status
  const markAsPurchased = async (logId: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('procurement_logs')
      .update({ status: 'purchased', purchase_date: new Date().toISOString() })
      .eq('id', logId);

    if (!error && institution) fetchLogs(institution.id);
  };

  // Delete Log
  const deleteLog = async (logId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('procurement_logs').delete().eq('id', logId);
    if (!error && institution) fetchLogs(institution.id);
  };

  return {
    institution,
    logs,
    loading,
    error,
    createInstitution,
    addToProcurement,
    markAsPurchased,
    deleteLog
  };
}
