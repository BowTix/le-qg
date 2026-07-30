import { useCallback, useEffect, useState } from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

export default function usePwaControls() {
  const isOnline = useNetworkStatus();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updateRegistration, setUpdateRegistration] = useState(null);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleUpdate = (event) => setUpdateRegistration(event.detail || null);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('pwa_update_available', handleUpdate);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('pwa_update_available', handleUpdate);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
    return choice.outcome === 'accepted';
  }, [installPrompt]);

  const applyUpdate = useCallback(() => {
    const worker = updateRegistration?.waiting;
    if (!worker) return;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    worker.postMessage({ type: 'SKIP_WAITING' });
  }, [updateRegistration]);

  return {
    isOnline,
    canInstall: Boolean(installPrompt),
    install,
    updateAvailable: Boolean(updateRegistration?.waiting),
    applyUpdate,
  };
}
