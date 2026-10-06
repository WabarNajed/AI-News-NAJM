export type Direction = 1 | -1;
export function scrollStep(
  position: number,
  maximum: number,
  direction: Direction,
  distance: number,
) {
  const next = Math.max(0, Math.min(maximum, position + direction * distance));
  const boundary =
    maximum > 0 && (direction === 1 ? next >= maximum : next <= 0);
  return {
    position: next,
    direction: (boundary ? -direction : direction) as Direction,
    boundary,
  };
}
