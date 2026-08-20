/** In-place: opaque where luma > 50%, else transparent. RGB unchanged. */
export function hardAlphaFromLuma(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i]! > 128 ? 255 : 0;
  }
}
