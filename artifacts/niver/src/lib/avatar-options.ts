type Palette = { background: string; accent: string; ink?: string };

const palettes: Record<string, Palette> = {
  star: { background: '#40215f', accent: '#f8cc6d' }, waves: { background: '#123d65', accent: '#7fe5ff' }, moon: { background: '#54224f', accent: '#ff9bd2' }, compass: { background: '#19524e', accent: '#93f5d2' }, sun: { background: '#693a15', accent: '#ffe08a' }, coral: { background: '#4d2341', accent: '#ffb0a8' },
  shell: { background: '#274a66', accent: '#bde4df' }, fish: { background: '#1c4052', accent: '#ffbd91' }, sail: { background: '#34345d', accent: '#d7d4ff' }, orbit: { background: '#30275a', accent: '#a9d7ff' }, diamond: { background: '#4b3555', accent: '#f1b3db' }, tide: { background: '#173e4a', accent: '#a0e6dc' },
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
};

export const avatarOptions = Object.keys(shapes).map((id) => ({ id, name: id, url: makeAvatar(id) }));
export const avatarAccents = [{ id: 'original', label: 'Original', color: '#f8cc6d' }, { id: 'brisa', label: 'Brisa', color: '#bfe9f4' }, { id: 'aurora', label: 'Aurora', color: '#efbedb' }, { id: 'maré', label: 'Maré', color: '#b9e4cb' }];

export function makeAvatar(id: string, accentId = 'original') {
  const palette = palettes[id] ?? palettes.star;
  const accent = accentId === 'original' ? palette.accent : avatarAccents.find((option) => option.id === accentId)?.color ?? palette.accent;
  const shape = (shapes[id] ?? shapes.star).replaceAll('ACCENT', accent);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.background}"/><stop offset="1" stop-color="#100d2c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="48" r="30" fill="none" stroke="${accent}" stroke-width="2" opacity=".45"/>${shape}</svg>`)}`;
}
