import type { CapacitorConfig } from "@capacitor/cli";

// Two supported modes:
// 1) Remote web view (easiest): point `server.url` at the production web app.
//    Any update to the web app instantly propagates to installed APKs.
// 2) Static bundle: run `next build && next export` (or configure
//    output: "export") and drop `webDir` pointing at the exported folder.

const config: CapacitorConfig = {
  appId: "app.futbool.mobile",
  appName: "Futbool",
  webDir: "out",
  server: {
    // Remote mode — uncomment and set for live-always APKs.
    // url: "https://futbool.app",
    // cleartext: false,
    androidScheme: "https",
  },
  backgroundColor: "#111a15",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
