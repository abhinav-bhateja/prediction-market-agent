export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export const safeDivide = (numerator: number, denominator: number): number => {
  if (denominator === 0) return 0;
  return numerator / denominator;
};
