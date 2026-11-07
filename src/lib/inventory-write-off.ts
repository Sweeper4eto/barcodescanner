/** Clamp write-off units to 0…quantity (inclusive). */
export function clampWriteOffQuantity(
  writeOff: number,
  quantity: number,
): number {
  if (!Number.isFinite(writeOff) || !Number.isFinite(quantity)) return 0;
  const max = Math.max(0, Math.trunc(quantity));
  return Math.min(Math.max(0, Math.trunc(writeOff)), max);
}
