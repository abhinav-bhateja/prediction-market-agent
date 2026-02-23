import OpenAI from 'openai';
import { config } from '../config/index.js';

export interface LlmEstimate {
  probabilityYes: number;
  confidence: number;
  rationale: string;
  keyDrivers: string[];
  riskFlags: string[];
}

export class LlmClient {
  private readonly openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;

  isEnabled(): boolean {
    return Boolean(this.openai);
  }

  async estimateProbability(prompt: string): Promise<LlmEstimate | null> {
    if (!this.openai) return null;

    const response = await this.openai.responses.create({
      model: config.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content:
            'You are a prediction-market analyst. Output JSON only with keys: probabilityYes (0-1), confidence (0-1), rationale, keyDrivers (string[]), riskFlags (string[]).'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const raw = response.output_text;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as LlmEstimate;
      if (typeof parsed.probabilityYes !== 'number' || typeof parsed.confidence !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
