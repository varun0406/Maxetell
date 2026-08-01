import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "./theme";

async function boot() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App: CapApp } = await import("@capacitor/app");
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          void import("./offline/syncWorker").then((m) => m.runSyncOnce());
        }
      });
    }
  } catch {
    /* web-only */
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

void boot();
