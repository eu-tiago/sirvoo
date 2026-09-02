import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.sirvo',
  appName: 'Sirvo',
  webDir: 'dist',
  server: {
    url: 'https://097e55e3-4ae7-4cd8-999e-c4bcf660ee0e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
