// Fuente única de color: la usan Tailwind (tailwind.config.js) y el código TS (estilos del mapa).
// Se mantiene en JS plano para poder hacer require() desde la config de Tailwind.

const palette = {
  ink: {
    DEFAULT: '#07080A', // fondo de la app / mar del mapa
    950: '#07080A',
    900: '#0C0D10',
    800: '#121418',
  },
  surface: {
    DEFAULT: '#14161B', // tarjetas, sheet
    raised: '#1B1E24',
    glass: 'rgba(20,22,27,0.78)',
  },
  line: {
    DEFAULT: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.14)',
  },
  fg: {
    DEFAULT: '#F5F6F8',
    muted: '#9AA0AB',
    subtle: '#5F6570',
  },
  accent: {
    DEFAULT: '#3CF0B0', // menta eléctrica: acciones principales y "tú"
    soft: 'rgba(60,240,176,0.14)',
    ink: '#03140D',
  },
  emt: { DEFAULT: '#FF3B4E', soft: 'rgba(255,59,78,0.16)' },
  metro: { DEFAULT: '#FFC21A', soft: 'rgba(255,194,26,0.16)' },
  tram: { DEFAULT: '#2FD27A', soft: 'rgba(47,210,122,0.16)' },
  bike: { DEFAULT: '#FF7A1A', soft: 'rgba(255,122,26,0.16)' },
};

module.exports = { palette };
