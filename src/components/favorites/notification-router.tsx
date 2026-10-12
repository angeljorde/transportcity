import { useEffect } from 'react';

import { getNotifications } from '@/lib/alerts';

/**
 * Al tocar un aviso (recordatorio o "¡Sal ya!") abre directamente las rutas de ese favorito.
 * Solo se monta donde hay notificaciones (ver `alertsSupported`): aquí el módulo ya existe.
 */
export function NotificationRouter({ onFavorite }: { onFavorite(favoriteId: string): void }) {
  const response = getNotifications()!.useLastNotificationResponse();
  useEffect(() => {
    const id = response?.notification.request.content.data?.favoriteId;
    if (typeof id === 'string') onFavorite(id);
    // Solo reaccionamos a respuestas nuevas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.notification.request.identifier]);
  return null;
}
