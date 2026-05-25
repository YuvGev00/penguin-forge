// Palette definitions — each maps to all the color keys consumed by
// rooms-outside.jsx, rooms-uni.jsx and landings.jsx. The Tweaks panel
// switches the active palette object; nothing else changes.

const PALETTES = {
  'icy-amber': {
    label: 'Icy & Amber',
    swatch: ['#b6e0ff', '#3a6a98', '#ffb84e'],
    // sky / snow / mountains
    sky: '#b6e0ff',
    skyTop: '#9fcdf2',
    skyMid: '#c4e2fb',
    skyBot: '#e6f3ff',
    snowDeep: '#e6effa',
    snowNear: '#fff',
    mountain: '#a9c4dd',
    // pine
    pine: '#5a9a68',
    pineDark: '#3a6e48',
    // wood (doors / floor accents)
    wood: '#8b5a36',
    woodDark: '#4a2e1a',
    // amber accents
    amber: '#ffce73',
    amberSoft: '#ffd47e',
    // stone (university exterior + interior walls)
    stone: '#6d6982',
    stoneDark: '#3a3550',
    stoneStep: '#6a6480',
    stoneStepLit: '#8a8aa2',
    windowGlow: '#3a4e7a',
    // pillars
    pillar: '#4a4760',
    pillarLit: '#5b5774',
    // café
    cafeWall: '#3a281f',
    cafeWallTop: '#52392c',
    // hall bg
    hallBg: '#1b1730',
    // generic stone-wall gradient stops
    stoneTop: '#322a4c',
    stoneBot: '#1b1730',
  },

  'twilight-berry': {
    label: 'Twilight Berry',
    swatch: ['#3a2466', '#a78bff', '#ffb84e'],
    sky: '#1a1336',
    skyTop: '#1a1336',
    skyMid: '#3a2466',
    skyBot: '#7a5a98',
    snowDeep: '#c8b8e0',
    snowNear: '#ece4f4',
    mountain: '#5a4878',
    pine: '#4a6a55',
    pineDark: '#2e4838',
    wood: '#7a4a3a',
    woodDark: '#3a1e1a',
    amber: '#ffce73',
    amberSoft: '#ffb070',
    stone: '#544a78',
    stoneDark: '#2a2348',
    stoneStep: '#4a3f70',
    stoneStepLit: '#6a5a92',
    windowGlow: '#4a3a7a',
    pillar: '#3a3060',
    pillarLit: '#5a4a82',
    cafeWall: '#2e1f3a',
    cafeWallTop: '#4a3258',
    hallBg: '#1a1130',
    stoneTop: '#2a2048',
    stoneBot: '#150d28',
  },

  'sunset-cocoa': {
    label: 'Sunset Cocoa',
    swatch: ['#ffb070', '#a44a5c', '#5a3a2a'],
    sky: '#ffd0a0',
    skyTop: '#ffa870',
    skyMid: '#ffc89a',
    skyBot: '#ffe8c8',
    snowDeep: '#f4dac0',
    snowNear: '#fff2dc',
    mountain: '#a07868',
    pine: '#7a6a4a',
    pineDark: '#4a3a28',
    wood: '#8b5a36',
    woodDark: '#4a2e1a',
    amber: '#ff9c33',
    amberSoft: '#ffce73',
    stone: '#6a584a',
    stoneDark: '#3a2820',
    stoneStep: '#6a584a',
    stoneStepLit: '#8a7868',
    windowGlow: '#a44a5c',
    pillar: '#5a3a2a',
    pillarLit: '#7a584a',
    cafeWall: '#3a2210',
    cafeWallTop: '#5a3a20',
    hallBg: '#2a1810',
    stoneTop: '#3a281c',
    stoneBot: '#1c0e08',
  },
};

window.PALETTES = PALETTES;
