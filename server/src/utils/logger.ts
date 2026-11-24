type LogLevel = 'info' | 'warn' | 'error';

type LogMetadata = Record<string, unknown>;

function write(level: LogLevel, message: string, metadata?: LogMetadata): void {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(metadata ?? {}),
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  if (level === 'warn') {
    console.warn(entry);
    return;
  }

  console.log(entry);
}

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    write('info', message, metadata);
  },
  warn(message: string, metadata?: LogMetadata): void {
    write('warn', message, metadata);
  },
  error(message: string, metadata?: LogMetadata): void {
    write('error', message, metadata);
  },
};
