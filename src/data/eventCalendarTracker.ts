import { config } from '../config/index.js';
import type { CalendarEvent } from '../types/domain.js';

export class EventCalendarTracker {
  async upcoming(): Promise<CalendarEvent[]> {
    if (config.EVENT_CALENDAR_API_URL) {
      try {
        const res = await fetch(config.EVENT_CALENDAR_API_URL);
        if (res.ok) {
          const data = (await res.json()) as CalendarEvent[];
          return data.slice(0, 50);
        }
      } catch {
        // Fall through to built-in calendar.
      }
    }

    const now = Date.now();
    return [
      {
        id: 'fed-next-meeting',
        title: 'FOMC Rate Decision',
        date: new Date(now + 1000 * 60 * 60 * 24 * 20).toISOString(),
        category: 'macro',
        relevanceScore: 0.85
      },
      {
        id: 'us-election-window',
        title: 'US Federal Election Milestone',
        date: new Date(now + 1000 * 60 * 60 * 24 * 50).toISOString(),
        category: 'politics',
        relevanceScore: 0.95
      }
    ];
  }
}
