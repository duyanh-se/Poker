import { describe, expect, it } from '@jest/globals';

import { loadAppConfig } from './app-config';

describe('loadAppConfig', () => {
  it('uses safe local defaults', () => {
    expect(loadAppConfig({})).toMatchObject({
      apiPort: 3001,
      nodeEnv: 'development',
      publicOrigin: 'http://localhost:3000',
      sessionCookieName: 'poker_session',
    });
  });

  it('rejects invalid public configuration before startup', () => {
    expect(() => loadAppConfig({ API_PORT: '70000' })).toThrow('API_PORT');
    expect(() => loadAppConfig({ PUBLIC_ORIGIN: 'not-a-url' })).toThrow('PUBLIC_ORIGIN');
    expect(() => loadAppConfig({ SESSION_COOKIE_NAME: 'invalid cookie name' })).toThrow(
      'SESSION_COOKIE_NAME',
    );
  });

  it('uses the hosting platform port when API_PORT is not configured', () => {
    expect(loadAppConfig({ PORT: '10000' }).apiPort).toBe(10000);
    expect(loadAppConfig({ API_PORT: '3001', PORT: '10000' }).apiPort).toBe(3001);
  });

  it('normalizes a configured browser origin', () => {
    expect(
      loadAppConfig({
        PUBLIC_ORIGIN: 'https://poker-1-qxy8.onrender.com/',
      }).publicOrigin,
    ).toBe('https://poker-1-qxy8.onrender.com');
  });
});
