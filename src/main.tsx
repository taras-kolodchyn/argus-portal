import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { ThemeProvider } from "@/hooks/useTheme";
import { queryClient } from "@/lib/query-client";
import "@/i18n";
import "./index.css";
import "leaflet/dist/leaflet.css";

const LazyAuthProvider = lazy(async () => {
  const module = await import("@/hooks/auth-provider");
  return { default: module.AuthProvider };
});

const AppTree = (
  <ThemeProvider>
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
          Preparing session...
        </div>
      }
    >
      <LazyAuthProvider>
        <App />
      </LazyAuthProvider>
    </Suspense>
  </ThemeProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{AppTree}</BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
