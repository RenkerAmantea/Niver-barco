const shapes: Record<string, string> = {
  star: '<path d="M48 17l7 24 24-7-17 17 17 17-24-7-7 25-7-25-24 7 17-17-17-17 24 7z" fill="ACCENT"/>',
  wave: '<path d="M18 45c10-13 20 13 30 0s20 13 30 0M18 61c10-13 20 13 30 0s20 13 30 0" fill="none" stroke="ACCENT" stroke-width="6" stroke-linecap="round"/>',
  moon: '<path d="M61 22a27 27 0 1 0 13 47A30 30 0 1 1 61 22z" fill="ACCENT"/>',
  compass: '<path d="M48 17l11 31-11 31-11-31zM17 48l31-11 31 11-31 11z" fill="ACCENT"/>',
  sun: '<circle cx="48" cy="48" r="15" fill="ACCENT"/><path d="M48 18v9m0 42v9M18 48h9m42 0h9M27 27l7 7m28 28 7 7m0-42-7 7M34 62l-7 7" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  coral: '<path d="M48 78V44m0 13L32 41m16 5 16-17M32 41V29m32 0v17" fill="none" stroke="ACCENT" stroke-width="7" stroke-linecap="round"/>',
  shell: '<path d="M20 67c0-28 13-43 28-43s28 15 28 43H20z" fill="ACCENT"/><path d="M32 67V38m16 29V30m16 37V38" stroke="#100d2c" stroke-width="3" opacity=".55"/>',
  fish: '<path d="M22 48c13-19 36-19 52 0-16 19-39 19-52 0z" fill="ACCENT"/><path d="M22 48L12 35v26z" fill="ACCENT"/><circle cx="57" cy="43" r="3" fill="#100d2c"/>',
  sail: '<path d="M48 18v59M48 23l27 42H48zM44 32L20 65h24z" fill="ACCENT"/><path d="M16 78h64" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  orbit: '<circle cx="48" cy="48" r="10" fill="ACCENT"/><ellipse cx="48" cy="48" rx="31" ry="13" fill="none" stroke="ACCENT" stroke-width="4"/><ellipse cx="48" cy="48" rx="13" ry="31" fill="none" stroke="ACCENT" stroke-width="4"/>',
  diamond: '<path d="M48 18l28 30-28 30-28-30z" fill="ACCENT"/><path d="M20 48h56M48 18v60" stroke="#100d2c" stroke-width="3" opacity=".45"/>',
  tide: '<path d="M18 60c9-32 23-32 30 0 7-32 21-32 30 0" fill="none" stroke="ACCENT" stroke-width="7" stroke-linecap="round"/>',
};
export const avatarOptions = Object.keys(shapes).map((id) => ({ id, name: id }));
export const avatarColors = ['#f8cc6d','#7fe5ff','#ff9bd2','#93f5d2','#ffb38a','#b7a1ff','#a5e47b','#ffda80'];
export function makeAvatar(id: string, accent: string) { const shape = (shapes[id] ?? shapes.star).replaceAll('ACCENT', accent); return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="#100d2c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="48" r="34" fill="none" stroke="${accent}" stroke-width="2" opacity=".45"/>${shape}</svg>`)}`; }
