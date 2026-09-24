export const MIN_3D_VIEWPORT = { width: 1024, height: 600 } as const;

/** A full 3D table is reserved for desktop-sized viewports. */
export function canRender3DTable(width: number, height: number): boolean {
  return width >= MIN_3D_VIEWPORT.width && height >= MIN_3D_VIEWPORT.height;
}
