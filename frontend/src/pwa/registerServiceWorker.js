export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('pwa_update_available', { detail: registration }));
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('pwa_update_available', { detail: registration }));
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_OFFLINE_RESULTS') {
          window.dispatchEvent(new Event('offline_sync_requested'));
        }
      });

      window.dispatchEvent(new CustomEvent('pwa_ready', { detail: registration }));
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
