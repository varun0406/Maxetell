import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.maxwell.trading",
  appName: "Maxwell Trading",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Point at your Fastify server when testing on device; override via capacitor.env
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
