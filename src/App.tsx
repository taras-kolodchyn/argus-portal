import type { ComponentType, JSX, LazyExoticComponent } from "react";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppLayout } from "@/components/layout/app-layout";

const DashboardPage = lazy(async () => ({
  default: (await import("@/pages/Dashboard")).DashboardPage,
}));
const ForecastPage = lazy(async () => ({
  default: (await import("@/pages/Forecast")).ForecastPage,
}));
const ComparePage = lazy(async () => ({
  default: (await import("@/pages/Compare")).ComparePage,
}));
const NotificationsPage = lazy(async () => ({
  default: (await import("@/pages/Notifications")).NotificationsPage,
}));
const ReportsPage = lazy(async () => ({
  default: (await import("@/pages/Reports")).ReportsPage,
}));
const ProfilePage = lazy(async () => ({
  default: (await import("@/pages/Profile")).ProfilePage,
}));
const DevicesPage = lazy(async () => ({
  default: (await import("@/pages/Devices")).DevicesPage,
}));
const LoginPage = lazy(async () => ({
  default: (await import("@/pages/Login")).LoginPage,
}));
const RegisterPage = lazy(async () => ({
  default: (await import("@/pages/Register")).RegisterPage,
}));

const routeFallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
    Loading view...
  </div>
);

function renderLazy(Component: LazyExoticComponent<ComponentType<unknown>>): JSX.Element {
  return (
    <Suspense fallback={routeFallback}>
      <Component />
    </Suspense>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={renderLazy(DashboardPage)} />
        <Route path="forecast" element={renderLazy(ForecastPage)} />
        <Route path="compare" element={renderLazy(ComparePage)} />
        <Route path="notifications" element={renderLazy(NotificationsPage)} />
        <Route path="devices" element={renderLazy(DevicesPage)} />
        <Route path="reports" element={renderLazy(ReportsPage)} />
        <Route path="profile" element={renderLazy(ProfilePage)} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="register" element={renderLazy(RegisterPage)} />
      </Route>
      <Route path="/auth/login" element={renderLazy(LoginPage)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
