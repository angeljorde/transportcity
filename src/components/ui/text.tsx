import { Text as RNText, type TextProps } from 'react-native';

// Clases text-* que NO son de color (tamaño, alineación…).
const NON_COLOR = /^text-(xs|sm|base|lg|\d*xl|left|right|center|justify|\[\d)/;
const hasColor = (cls: string) => cls.split(/\s+/).some((c) => c.startsWith('text-') && !NON_COLOR.test(c));
const hasFamily = (cls: string) => /\bfont-(sans|jk-)/.test(cls);

/** Text con la tipografía y el color base de la app; respeta los que pase `className`. */
export function Text({ className = '', ...props }: TextProps & { className?: string }) {
  const base = `${hasFamily(className) ? '' : 'font-sans'} ${hasColor(className) ? '' : 'text-fg'}`;
  return <RNText className={`${base} ${className}`} {...props} />;
}
