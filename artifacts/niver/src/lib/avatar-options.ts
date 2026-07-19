type Palette = { background: string; accent: string; ink?: string };

const palettes: Record<string, Palette> = {
  star: { background: '#40215f', accent: '#f8cc6d' }, waves: { background: '#123d65', accent: '#7fe5ff' }, moon: { background: '#54224f', accent: '#ff9bd2' }, compass: { background: '#19524e', accent: '#93f5d2' }, sun: { background: '#693a15', accent: '#ffe08a' }, coral: { background: '#4d2341', accent: '#ffb0a8' },
  shell: { background: '#274a66', accent: '#bde4df' }, fish: { background: '#1c4052', accent: '#ffbd91' }, sail: { background: '#34345d', accent: '#d7d4ff' }, orbit: { background: '#30275a', accent: '#a9d7ff' }, diamond: { background: '#4b3555', accent: '#f1b3db' }, tide: { background: '#173e4a', accent: '#a0e6dc' },
  anchor: { background: '#233b5c', accent: '#cfdef3' }, lighthouse: { background: '#543044', accent: '#ffd39a' }, seahorse: { background: '#2e4f53', accent: '#f0c0a4' }, jelly: { background: '#3d315c', accent: '#d9bdf0' }, whale: { background: '#193e54', accent: '#90d6e8' }, reef: { background: '#4d3045', accent: '#e7a9b5' }, knot: { background: '#2e4d45', accent: '#c5e6bb' }, pearl: { background: '#544637', accent: '#f3d8b2' }, constellation: { background: '#292448', accent: '#c4c8ff' }, buoy: { background: '#5b342b', accent: '#ffd4aa' }, oar: { background: '#45344d', accent: '#e8c4d8' }, horizon: { background: '#214a5d', accent: '#f0dd9a' },
};

const shapes: Record<string, string> = {
  star: '<path d="M48 20l5.5 18 18.5-5.5-13 13L72 58l-18.5-1L48 76l-5.5-19L24 58l13-12.5-13-13 18.5 5.5z" fill="ACCENT"/>',
  waves: '<path d="M20 51c9-12 17 12 28 0s19 12 28 0M20 63c9-12 17 12 28 0s19 12 28 0" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  moon: '<path d="M61 24a25 25 0 1 0 11 43A28 28 0 1 1 61 24z" fill="ACCENT"/>',
  compass: '<path d="M48 18l10 30-10 30-10-30z" fill="ACCENT"/><path d="M18 48l30-10 30 10-30 10z" fill="ACCENT" opacity=".7"/>',
  sun: '<circle cx="48" cy="48" r="16" fill="ACCENT"/><path d="M48 20v9m0 38v9M20 48h9m38 0h9M28 28l6 6m28 28 6 6m0-40-6 6M34 62l-6 6" stroke="ACCENT" stroke-width="4" stroke-linecap="round"/>',
  coral: '<path d="M48 72V43m0 12L34 41m14 5 15-16M34 41v-11m29 0v14" fill="none" stroke="ACCENT" stroke-width="6" stroke-linecap="round"/>',
  shell: '<path d="M21 70c0-28 12-44 27-44s27 16 27 44H21z" fill="none" stroke="ACCENT" stroke-width="5"/><path d="M32 67V41m16 26V33m16 34V41" stroke="ACCENT" stroke-width="3" opacity=".75"/>',
  fish: '<path d="M24 48c13-17 34-17 49 0-15 17-36 17-49 0zM24 48L14 37v22z" fill="none" stroke="ACCENT" stroke-width="5" stroke-linejoin="round"/><circle cx="59" cy="44" r="2.5" fill="ACCENT"/>',
  sail: '<path d="M48 18v59M48 23l27 42H48zM44 32L20 65h24zM16 78h64" fill="none" stroke="ACCENT" stroke-width="4" stroke-linejoin="round"/>',
  orbit: '<circle cx="48" cy="48" r="9" fill="ACCENT"/><ellipse cx="48" cy="48" rx="29" ry="12" fill="none" stroke="ACCENT" stroke-width="3.5"/><ellipse cx="48" cy="48" rx="12" ry="29" fill="none" stroke="ACCENT" stroke-width="3.5"/>',
  diamond: '<path d="M48 18l28 30-28 30-28-30zM20 48h56M48 18v60" fill="none" stroke="ACCENT" stroke-width="4" stroke-linejoin="round"/>',
  tide: '<path d="M18 61c9-31 23-31 30 0 7-31 21-31 30 0" fill="none" stroke="ACCENT" stroke-width="6" stroke-linecap="round"/>',
  anchor: '<path d="M48 18v42m-9-31h18m-30 31c0 14 9 20 21 20s21-6 21-20M24 60h48" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="17" r="5" fill="ACCENT"/>',
  lighthouse: '<path d="M37 76h22l-4-37H41zM40 39h16l-3-13H43zM32 77h32M29 28l10 4m18 0 10-4M27 50h10m22 0h10" fill="none" stroke="ACCENT" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  seahorse: '<path d="M57 21c-16 0-19 18-8 25 9 6 3 22-8 18-8-3-10 9-1 13 12 5 23-4 21-18-1-8-9-10-8-17 1-7 13-5 13 4" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/><circle cx="56" cy="28" r="2.5" fill="ACCENT"/>',
  jelly: '<path d="M27 53c0-18 9-29 21-29s21 11 21 29H27zM33 54v16m10-16v10m10-10v16m10-16v10" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  whale: '<path d="M20 55c9-17 29-25 50-14 7 4 7 11 0 16-19 12-40 4-50-2zM25 53l-10-9m10 9-11 6" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="56" cy="47" r="2.5" fill="ACCENT"/>',
  reef: '<path d="M31 77V52m0 10-9-12m9-2 10-17m8 46V46m0 16 11-15m-11 1-8-14m27 43V58m0 8 8-9" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  knot: '<path d="M29 36c9-12 29-12 38 0 8 11-5 24-16 17-2-5-8-5-11 0-11 7-24-6-16-17 9-12 29-12 38 0 8 11-5 24-16 17" fill="none" stroke="ACCENT" stroke-width="4" stroke-linecap="round"/>',
  pearl: '<circle cx="48" cy="48" r="20" fill="none" stroke="ACCENT" stroke-width="4"/><path d="M29 49c-4-15 6-27 19-27s23 12 19 27" fill="none" stroke="ACCENT" stroke-width="4"/><circle cx="48" cy="48" r="8" fill="ACCENT"/>',
  constellation: '<path d="M25 66l12-28 18 14 16-25M23 28h.1M37 38h.1M55 52h.1M71 27h.1M25 66h.1" stroke="ACCENT" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="66" r="4" fill="ACCENT"/><circle cx="37" cy="38" r="4" fill="ACCENT"/><circle cx="55" cy="52" r="4" fill="ACCENT"/><circle cx="71" cy="27" r="4" fill="ACCENT"/>',
  buoy: '<path d="M48 21v54M34 33h28M34 52h28M22 76h52" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="21" r="6" fill="ACCENT"/>',
  oar: '<path d="M28 71L65 26M21 76l13-7M61 28l14-8M40 57l10 8" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  horizon: '<path d="M18 62h60M24 62c7-14 15-21 24-21s17 7 24 21M48 23v8m-20 1 6 6m34-6-6 6" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>'
};

export const avatarOptions = Object.keys(shapes).map((id) => ({ id, name: id, url: makeAvatar(id) }));
export const avatarAccents = [{ id: 'original', label: 'Original', color: '#f8cc6d' }, { id: 'brisa', label: 'Brisa', color: '#bfe9f4' }, { id: 'aurora', label: 'Aurora', color: '#efbedb' }, { id: 'maré', label: 'Maré', color: '#b9e4cb' }];

export function makeAvatar(id: string, accentId = 'original') {
  const palette = palettes[id] ?? palettes.star;
  const accent = accentId === 'original' ? palette.accent : avatarAccents.find((option) => option.id === accentId)?.color ?? palette.accent;
  const shape = (shapes[id] ?? shapes.star).replaceAll('ACCENT', accent);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.background}"/><stop offset="1" stop-color="#100d2c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="48" r="30" fill="none" stroke="${accent}" stroke-width="2" opacity=".45"/>${shape}</svg>`)}`;
}
