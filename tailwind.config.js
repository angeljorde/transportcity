const { palette } = require('./src/theme/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: palette.ink,
        surface: palette.surface,
        line: palette.line,
        fg: palette.fg,
        accent: palette.accent,
        emt: palette.emt,
        metro: palette.metro,
        tram: palette.tram,
        bike: palette.bike,
      },
      // Una familia por peso: en Android, combinar fontFamily custom + fontWeight cae a la fuente del sistema.
      fontFamily: {
        sans: ['Jakarta'],
        'jk-medium': ['Jakarta-Medium'],
        'jk-semibold': ['Jakarta-SemiBold'],
        'jk-bold': ['Jakarta-Bold'],
        'jk-xbold': ['Jakarta-ExtraBold'],
      },
      borderRadius: {
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};
