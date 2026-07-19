import { useEffect, useRef } from 'react';

// iOS requires Notification.requestPermission() to run inside a direct user
// gesture (a tap), or it silently resolves to "denied" without ever showing
// the native prompt. Call this from an onClick handler only.
export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('DEBUG badge: Notification API não existe neste contexto.');
    return;
  }
  Notification.requestPermission().then((perm) => {
    alert(`DEBUG badge: permissão de notificação = "${perm}".`);
  });
}

// Sets the numeric badge on the installed app's icon (Dock/Home Screen) via
// the Badging API. Only affects the device this runs on — each device
// updates its own badge only while the app is open there.
export function useAppBadge(count) {
  const debuggedRef = useRef(false);

  useEffect(() => {
    if (!('setAppBadge' in navigator)) {
      if (!debuggedRef.current) {
        debuggedRef.current = true;
        alert('DEBUG badge: navigator.setAppBadge não existe neste contexto.');
      }
      return;
    }
    const action = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    action
      .then(() => {
        if (!debuggedRef.current && count > 0) {
          debuggedRef.current = true;
          alert(`DEBUG badge: setAppBadge(${count}) OK. Vá pra Home Screen agora e confira o ícone.`);
        }
      })
      .catch((err) => {
        if (!debuggedRef.current) {
          debuggedRef.current = true;
          alert(`DEBUG badge: falhou (count=${count}) — ${err?.name || ''} ${err?.message || err}`);
        }
      });
  }, [count]);
}
