/** 'ANG MO KIO' -> 'Ang Mo Kio', 'KALLANG/WHAMPOA' -> 'Kallang/Whampoa' */
export function displayTown(town: string): string {
  return town
    .toLowerCase()
    .replace(/(^|[ /])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** '4 ROOM' -> '4-room', 'EXECUTIVE' -> 'executive' */
export function displayFlatType(flatType: string): string {
  if (flatType === "EXECUTIVE") return "executive";
  const m = flatType.match(/^(\d) ROOM$/);
  return m ? `${m[1]}-room` : flatType.toLowerCase();
}