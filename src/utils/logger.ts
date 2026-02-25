type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: Level = (process.env['LOG_LEVEL'] as Level | undefined) ?? 'info';

const emit = (level: Level, msg: string, meta?: unknown) => {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg
  };
  if (meta !== undefined && meta !== null) {
    if (meta instanceof Error) {
      entry['err'] = { message: meta.message, stack: meta.stack };
    } else if (typeof meta === 'object') {
      Object.assign(entry, meta);
    } else {
      entry['data'] = meta;
    }
  }
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
};

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta)
};
