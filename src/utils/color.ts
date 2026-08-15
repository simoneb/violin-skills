/** Linearly blends two `#rrggbb` colors; `t=0` is `hexA`, `t=1` is `hexB`. */
export function mixColors(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const mix = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * clamped);
  };
  const r = mix(16);
  const g = mix(8);
  const bl = mix(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Picks whichever of `a`/`b` contrasts more strongly against `bg`. */
export function pickContrastText(bg: string, a: string, b: string): string {
  const bgLuminance = luminance(bg);
  return Math.abs(luminance(a) - bgLuminance) >= Math.abs(luminance(b) - bgLuminance) ? a : b;
}
