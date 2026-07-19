import { useEffect } from 'react';

// iOS requires Notification.requestPermission() to run inside a direct user
// gesture (a tap), or it silently resolves to "denied" without ever showing
// the native prompt. Call this from an onClick handler only. Granting
// notification permission is also what unlocks the home-screen app badge on
// iOS, even though this app never sends notifications.
export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then((perm) => {
    if (perm === 'granted') {
      alert('Notificações ativadas! O selo no ícone do app já deve funcionar.');
    } else {
      alert('Permissão negada. O selo no ícone não vai aparecer.');
    }
  });
}

// Sets the numeric badge on the installed app's icon (Dock/Home Screen) via
// the Badging API. Only affects the device this runs on — each device
// updates its own badge only while the app is open there.
export function useAppBadge(count) {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const action = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    action.catch(() => {});
  }, [count]);
}
