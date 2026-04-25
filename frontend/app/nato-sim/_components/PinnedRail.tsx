"use client";

/**
 * PinnedRail — kept as a no-op export for backwards compatibility,
 * but no longer rendered in the layout. Pins live inline in the
 * active product instead. Removing the rail freed ~240px of canvas
 * width, which the JWICS-flavor layout uses for more dense prose.
 */
export function PinnedRail() {
  return null;
}
