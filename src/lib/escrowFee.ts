type EscrowFeeConfig = {
  percent: number;
  flatNaira: number;
};

const defaultConfig: EscrowFeeConfig = {
  percent: 1.5,
  flatNaira: 100,
};

export const MIN_ESCROW_NAIRA = Number(import.meta.env.VITE_ESCROW_MIN_PRICE_NGN ?? 50000);
export const MIN_ESCROW_KOBO = Math.round(MIN_ESCROW_NAIRA * 100);

export function toKobo(naira: number): number {
  const n = Number(naira ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatNairaFromKobo(kobo: number): string {
  const n = Number(kobo ?? 0) / 100;
  if (!Number.isFinite(n)) return "\u20A60";
  return `\u20A6${n.toLocaleString("en-NG")}`;
}

export function calcEscrowFeeKobo(subtotalKobo: number, cfg?: Partial<EscrowFeeConfig>) {
  const percentEnv = Number(import.meta.env.VITE_ESCROW_FEE_PERCENT ?? "");
  const flatEnv = Number(import.meta.env.VITE_ESCROW_FEE_FLAT_NGN ?? "");

  const config: EscrowFeeConfig = {
    percent: Number.isFinite(percentEnv) && percentEnv > 0 ? percentEnv : defaultConfig.percent,
    flatNaira: Number.isFinite(flatEnv) && flatEnv >= 0 ? flatEnv : defaultConfig.flatNaira,
    ...cfg,
  };

  const subtotal = Math.max(0, Math.round(Number(subtotalKobo ?? 0)));
  if (!subtotal) {
    return { feeKobo: 0, totalKobo: 0 };
  }

  const flatKobo = toKobo(config.flatNaira);
  const percentFee = Math.ceil((subtotal * config.percent) / 100);
  const feeKobo = flatKobo + percentFee;
  const totalKobo = subtotal + feeKobo;
  return { feeKobo, totalKobo };
}
