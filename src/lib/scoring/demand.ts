import type { DemandCalibration } from "@/lib/domain/types";

export interface DemandNormalizationResult {
  /** 0-100, or null when there is no volume data. */
  score: number | null;
  /** Human-readable explanation of how the number was produced. */
  explanation: string;
  /** The metric the calculation was based on. */
  input: number | null;
}

/**
 * Normalises monthly search volume onto a 0-100 scale.
 *
 * There is no universal formula for "how much demand is enough", so this is a
 * deliberately simple, transparent, log-scaled interpolation between two
 * operator-calibrated points:
 *
 *   volume <= floor    -> 0
 *   volume >= ceiling  -> 100
 *   in between         -> log interpolation
 *
 * A log curve is used because the difference between 100 and 1,000 searches per
 * month matters far more than the difference between 40,000 and 41,000. Both
 * calibration points live in Settings so the curve can be recalibrated per
 * market instead of being hardcoded.
 */
export function normalizeSearchVolume(
  volume: number | null | undefined,
  calibration: DemandCalibration,
): DemandNormalizationResult {
  if (volume === null || volume === undefined || Number.isNaN(volume)) {
    return {
      score: null,
      input: null,
      explanation:
        "No search volume recorded. Demand cannot be scored and contributes 0 points until a volume is supplied.",
    };
  }

  const floor = Math.max(1, calibration.floor);
  const ceiling = Math.max(floor + 1, calibration.ceiling);

  if (volume <= floor) {
    return {
      score: 0,
      input: volume,
      explanation: `${formatNumber(volume)} searches/mo is at or below the calibrated floor of ${formatNumber(floor)}/mo, so demand scores 0.`,
    };
  }

  if (volume >= ceiling) {
    return {
      score: 100,
      input: volume,
      explanation: `${formatNumber(volume)} searches/mo is at or above the calibrated ceiling of ${formatNumber(ceiling)}/mo, so demand scores 100.`,
    };
  }

  const score =
    (Math.log(volume / floor) / Math.log(ceiling / floor)) * 100;
  const rounded = Math.round(score);

  return {
    score: rounded,
    input: volume,
    explanation: `${formatNumber(volume)} searches/mo, log-interpolated between the calibrated floor (${formatNumber(floor)}/mo = 0) and ceiling (${formatNumber(ceiling)}/mo = 100), gives ${rounded}/100.`,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
