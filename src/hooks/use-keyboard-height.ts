import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Alto del teclado en pantalla (0 si está oculto). En Android con edge-to-edge la ventana
 * no se redimensiona al abrir el teclado y KeyboardAvoidingView no basta: hay que apartarse a mano.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // iOS avisa antes de animar; Android solo cuando ya se ha mostrado.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, (e) => setHeight(e.endCoordinates.height)),
      Keyboard.addListener(hide, () => setHeight(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return height;
}
