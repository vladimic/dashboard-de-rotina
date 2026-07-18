import { useEffect } from 'react';

// Sets the numeric badge on the installed app's icon (Dock/Home Screen) via
// the Badging API. Only affects the device this runs on — each device
// updates its own badge only while the app is open there.
export function useAppBadge(count) {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [count]);
}
