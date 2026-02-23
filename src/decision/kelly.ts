import { clamp } from '../utils/math.js';

export const kellyFractionBinary = (probabilityWin: number, oddsDecimal: number): number => {
  if (oddsDecimal <= 1) return 0;
  const b = oddsDecimal - 1;
  const p = clamp(probabilityWin, 0, 1);
  const q = 1 - p;
  const f = (b * p - q) / b;
  return clamp(f, 0, 1);
};
