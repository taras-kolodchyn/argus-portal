import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { queryClient } from "@/lib/query-client";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import "@/i18n";
import "./index.css";
import "leaflet/dist/leaflet.css";

const recaptchaKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() ?? "";

const AppTree = (
  <ThemeProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);

const AppWithCaptcha = recaptchaKey ? (
  <GoogleReCaptchaProvider
    reCaptchaKey={recaptchaKey}
    scriptProps={{ async: true, defer: true, appendTo: "body" }}
  >
    {AppTree}
  </GoogleReCaptchaProvider>
) : (
  AppTree
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{AppWithCaptcha}</BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
