const svg = (background: string, accent: string, shape: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#100d2c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="48" r="30" fill="none" stroke="${accent}" stroke-width="2" opacity=".45"/>${shape}</svg>`)}`;

export const avatarOptions = [
  { id: 'star', name: 'Estrela polar', url: svg('#40215f', '#f8cc6d', '<path d="M48 20l5.5 18 18.5-5.5-13 13L72 58l-18.5-1L48 76l-5.5-19L24 58l13-12.5-13-13 18.5 5.5z" fill="#f8cc6d"/>') },
  { id: 'waves', name: 'Maré', url: svg('#123d65', '#7fe5ff', '<path d="M20 51c9-12 17 12 28 0s19 12 28 0M20 63c9-12 17 12 28 0s19 12 28 0" fill="none" stroke="#7fe5ff" stroke-width="5" stroke-linecap="round"/>') },
  { id: 'moon', name: 'Lua', url: svg('#54224f', '#ff9bd2', '<path d="M61 24a25 25 0 1 0 11 43A28 28 0 1 1 61 24z" fill="#ff9bd2"/>') },
  { id: 'compass', name: 'Bússola', url: svg('#19524e', '#93f5d2', '<path d="M48 18l10 30-10 30-10-30z" fill="#93f5d2"/><path d="M18 48l30-10 30 10-30 10z" fill="#93f5d2" opacity=".7"/>') },
  { id: 'sun', name: 'Sol', url: svg('#693a15', '#ffe08a', '<circle cx="48" cy="48" r="16" fill="#ffe08a"/><path d="M48 20v9m0 38v9M20 48h9m38 0h9M28 28l6 6m28 28 6 6m0-40-6 6M34 62l-6 6" stroke="#ffe08a" stroke-width="4" stroke-linecap="round"/>') },
  { id: 'coral', name: 'Coral', url: svg('#4d2341', '#ffb0a8', '<path d="M48 72V43m0 12L34 41m14 5 15-16M34 41v-11m29 0v14" fill="none" stroke="#ffb0a8" stroke-width="6" stroke-linecap="round"/>') },
];
