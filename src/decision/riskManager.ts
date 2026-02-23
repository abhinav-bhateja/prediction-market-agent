import { config } from '../config/index.js';
import type { Position } from '../types/domain.js';

export interface RiskCheckInput {
  bankrollUsd: number;
  proposedSizeUsd: number;
  existingPositions: Position[];
}

export interface RiskCheckResult {
  allowedSizeUsd: number;
  constraintsApplied: string[];
}

export class RiskManager {
  check(input: RiskCheckInput): RiskCheckResult {
    const constraintsApplied: string[] = [];
    let allowedSize = input.proposedSizeUsd;

    const maxPerPosition = input.bankrollUsd * config.MAX_POSITION_PCT;
    if (allowedSize > maxPerPosition) {
      allowedSize = maxPerPosition;
      constraintsApplied.push(`Capped by max position pct (${config.MAX_POSITION_PCT})`);
    }

    const currentExposure = input.existingPositions.reduce(
      (acc, pos) => acc + Math.abs(pos.quantity * pos.markPrice),
      0
    );
    const maxExposure = input.bankrollUsd * config.MAX_PORTFOLIO_EXPOSURE_PCT;
    const remainingExposure = Math.max(0, maxExposure - currentExposure);

    if (allowedSize > remainingExposure) {
      allowedSize = remainingExposure;
      constraintsApplied.push(`Capped by portfolio exposure pct (${config.MAX_PORTFOLIO_EXPOSURE_PCT})`);
    }

    if (allowedSize < 1) {
      allowedSize = 0;
      constraintsApplied.push('Below minimum executable size');
    }

    return { allowedSizeUsd: allowedSize, constraintsApplied };
  }
}
