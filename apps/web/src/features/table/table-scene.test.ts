import { describe, expect, it } from 'vitest';

import { canRender3DTable, MIN_3D_VIEWPORT } from './table-render-mode';

describe('canRender3DTable', () => {
  it('uses 3D only for a desktop-sized viewport', () => {
    expect(canRender3DTable(1440, 900)).toBe(true);
    expect(canRender3DTable(MIN_3D_VIEWPORT.width, MIN_3D_VIEWPORT.height)).toBe(true);
  });

  it('uses the readable 2D table below either limit', () => {
    expect(canRender3DTable(1023, 900)).toBe(false);
    expect(canRender3DTable(1024, 599)).toBe(false);
    expect(canRender3DTable(844, 390)).toBe(false);
  });
});
