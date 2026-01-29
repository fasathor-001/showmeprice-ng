
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// STRICT: Only use env var. No fallback to test keys if "remove demo money" is requested.
const PUBLIC_KEY = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '';

export function usePayment() {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePremiumUpgrade = async (onSuccess: () => void) => {
    if (!user) {
        setError("Please sign in to upgrade.");
        return;
    }

    if (!PUBLIC_KEY) {
        setError("Payment system configuration missing.");
        return;
    }

    setProcessing(true);
    setError(null);

    const config = {
        reference: (new Date()).getTime().toString(),
        email: user.email,
        amount: 250000, // 2,500 NGN in kobo
        publicKey: PUBLIC_KEY,
        metadata: {
            custom_fields: [
                { display_name: "Plan", variable_name: "plan", value: "premium" },
                { display_name: "User ID", variable_name: "user_id", value: user.id }
            ]
        }
    };

    const handleSuccess = async (reference: any) => {
        try {
            if (!supabase) throw new Error("Database unavailable");
            
            // Call Supabase RPC to record and upgrade
            const { error: rpcError } = await supabase.rpc('process_premium_upgrade', {
                p_user_id: user.id,
                p_reference: reference.reference,
                p_amount: 2500.00
            });

            if (rpcError) throw rpcError;

            onSuccess();
        } catch (err: any) {
            console.error("Upgrade error:", err);
            setError("Payment successful but upgrade failed. Please contact support with Ref: " + reference.reference);
        } finally {
            setProcessing(false);
        }
    };

    const handleClose = () => {
        setProcessing(false);
    };

    return { config, handleSuccess, handleClose };
  };

  return { initiatePremiumUpgrade, processing, error };
}
