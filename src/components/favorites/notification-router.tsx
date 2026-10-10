import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

/**
 * Al tocar un aviso (recordatorio o "¡Sal ya!") abre directamente las rutas de ese favorito.
 * Solo se monta en iOS/Android (en web no hay notificaciones).
 */
export function NotificationRouter({ onFavorite }: { onFavorite(favoriteId: string): void }) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const id = response?.notification.request.content.data?.favoriteId;
    if (typeof id === 'string') onFavorite(id);
    // Solo reaccionamos a respuestas nuevas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.notification.request.identifier]);
  return null;
}
