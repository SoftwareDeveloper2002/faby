// Shared deposit math used by the booking-confirm, payment, and admin (settings/payments)
// screens so the "rental subtotal + deposit = total amount" calculation only lives in one
// place. Kept as plain functions (no Angular DI) so any component can import it directly.

export type DepositType = 'one_time' | 'recurring';

export type DepositConfig = {
  amount: number;
  type: DepositType;
  /** Only meaningful when type === 'recurring'. e.g. 5 = "charge again every 5 days". */
  intervalDays: number;
};

export const DEFAULT_DEPOSIT_CONFIG: DepositConfig = {
  amount: 0,
  type: 'one_time',
  intervalDays: 7,
};

/**
 * Number of deposit "charges" for a rental of the given length.
 * One-time deposits always resolve to 1 charge. Recurring deposits charge once per
 * interval, and any partial extra period still counts as one more charge — e.g. a
 * 5-day interval over a 14-day rental is 3 cycles (5 + 5 + 4), not 2.8.
 */
export function getDepositCycles(config: DepositConfig | null | undefined, totalDays: number): number {
  if (!config || totalDays <= 0) {
    return totalDays > 0 ? 1 : 0;
  }

  if (config.type !== 'recurring' || !Number.isFinite(config.intervalDays) || config.intervalDays <= 0) {
    return 1;
  }

  return Math.ceil(totalDays / config.intervalDays);
}

/** Total deposit amount owed for a rental of the given length, rounded to whole currency units. */
export function calculateDeposit(config: DepositConfig | null | undefined, totalDays: number): number {
  if (!config || !Number.isFinite(config.amount) || config.amount <= 0 || totalDays <= 0) {
    return 0;
  }

  const cycles = getDepositCycles(config, totalDays);
  return Math.round(config.amount * cycles);
}

export type RentalBreakdown = {
  rentalSubtotal: number;
  depositAmount: number;
  depositCycles: number;
  totalAmount: number;
};

export function buildRentalBreakdown(
  rentalSubtotal: number,
  config: DepositConfig | null | undefined,
  totalDays: number,
): RentalBreakdown {
  const safeSubtotal = Number.isFinite(rentalSubtotal) && rentalSubtotal > 0 ? rentalSubtotal : 0;
  const depositAmount = calculateDeposit(config, totalDays);
  const depositCycles = depositAmount > 0 ? getDepositCycles(config, totalDays) : 0;

  return {
    rentalSubtotal: safeSubtotal,
    depositAmount,
    depositCycles,
    totalAmount: safeSubtotal + depositAmount,
  };
}

/** Parses a raw Firebase record (e.g. from `productDeposits/{id}`) into a safe DepositConfig. */
export function parseDepositConfig(raw: unknown): DepositConfig | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const amount = Number(record['amount'] ?? 0);
  const type: DepositType = record['type'] === 'recurring' ? 'recurring' : 'one_time';
  const intervalDays = Number(record['intervalDays'] ?? 7);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    amount,
    type,
    intervalDays: Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 7,
  };
}
