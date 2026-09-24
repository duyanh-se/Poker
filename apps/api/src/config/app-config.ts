export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export interface AppConfig {
  apiPort: number;
  nodeEnv: 'development' | 'test' | 'production';
  publicOrigin: string;
  logLevel: LogLevel;
  sessionCookieName: string;
}

const allowedEnvironments = new Set<AppConfig['nodeEnv']>(['development', 'test', 'production']);
const allowedLogLevels = new Set<LogLevel>(['error', 'warn', 'log', 'debug', 'verbose']);

function readPort(value: string | undefined, fallback: number, name: string): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}

export function loadAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (environment.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const publicOrigin = environment.PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const logLevel = (environment.LOG_LEVEL ?? 'log') as LogLevel;
  const sessionCookieName = environment.SESSION_COOKIE_NAME ?? 'poker_session';

  if (!allowedEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  try {
    new URL(publicOrigin);
  } catch {
    throw new Error('PUBLIC_ORIGIN must be a valid URL.');
  }

  if (!allowedLogLevels.has(logLevel)) {
    throw new Error('LOG_LEVEL must be error, warn, log, debug, or verbose.');
  }

  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(sessionCookieName)) {
    throw new Error('SESSION_COOKIE_NAME must be a valid cookie name.');
  }

  return {
    apiPort: readPort(environment.API_PORT, 3001, 'API_PORT'),
    nodeEnv,
    publicOrigin,
    logLevel,
    sessionCookieName,
  };
}
