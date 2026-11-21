import type { BenefitParams } from "./params.js";
import { round2 } from "./utils.js";

export type SegmentType =
  | "maternity" // urlop macierzyński
  | "maternity_conditions" // urlop na warunkach urlopu macierzyńskiego (adopcja / rodzina zastępcza)
  | "supplementary_maternity" // uzupełniający urlop macierzyński
  | "parental" // urlop rodzicielski
  | "paternity"; // urlop ojcowski

/**
 * Art. 31 ustawy zasiłkowej – procent podstawy wymiaru dla danego okresu.
 * @param combinedApplication wniosek o zasiłek za macierzyński + rodzicielski złożony do 21 dni (Art. 30a)
 * @param secondParentExclusivePart okres z 9 tygodni przysługujących wyłącznie drugiemu rodzicowi (Art. 182^1a § 4 KP)
 */
export function benefitRate(
  p: BenefitParams,
  type: SegmentType,
  opts: { combinedApplication: boolean; secondParentExclusivePart?: boolean },
): number {
  switch (type) {
    case "maternity":
    case "maternity_conditions":
      return opts.combinedApplication ? p.RATE_COMBINED_21_DAYS : p.RATE_FULL; // ust. 1 i 3
    case "supplementary_maternity":
    case "paternity":
      return p.RATE_FULL; // ust. 1
    case "parental":
      if (!opts.combinedApplication || opts.secondParentExclusivePart)
        return p.RATE_PARENTAL_70; // ust. 2, 3f
      return p.RATE_COMBINED_21_DAYS; // ust. 3
  }
}

export interface BenefitAmount {
  /** Miesięczna kwota zasiłku (po podwyższeniu do minimum i obniżeniu za pracę). */
  monthlyAmount: number;
  /** Stawka dzienna = 1/30 kwoty miesięcznej (Art. 36 ust. 3, Art. 11 ust. 5). */
  dailyAmount: number;
  /** Kwota za cały okres. */
  totalAmount: number;
  /** Czy zastosowano podwyższenie do kwoty świadczenia rodzicielskiego (Art. 31 ust. 3a). */
  raisedToFloor: boolean;
}

/**
 * Kwota zasiłku za okres `days` dni kalendarzowych (zasiłek przysługuje za każdy dzień – Art. 31 ust. 5 w zw. z Art. 11 ust. 4).
 * @param workFte wymiar etatu wykonywanej pracy podczas urlopu rodzicielskiego – zasiłek maleje proporcjonalnie (Art. 31 ust. 4a)
 */
export function benefitAmount(
  p: BenefitParams,
  opts: { monthlyBasis: number; rate: number; days: number; workFte?: number },
): BenefitAmount {
  const base = opts.monthlyBasis * opts.rate;
  const raisedToFloor = base < p.PARENTAL_BENEFIT_FLOOR_MONTHLY;
  const monthly =
    Math.max(base, p.PARENTAL_BENEFIT_FLOOR_MONTHLY) *
    (1 - (opts.workFte ?? 0));
  const dailyAmount = round2(monthly / p.STATUTORY_MONTH_DAYS);
  return {
    monthlyAmount: round2(monthly),
    dailyAmount,
    totalAmount: round2(dailyAmount * opts.days),
    raisedToFloor,
  };
}
