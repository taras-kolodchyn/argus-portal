import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/auth/require-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "@/pages/Dashboard";
import { ForecastPage } from "@/pages/Forecast";
import { ComparePage } from "@/pages/Compare";
import { NotificationsPage } from "@/pages/Notifications";
import { ReportsPage } from "@/pages/Reports";
import { ProfilePage } from "@/pages/Profile";
import { DevicesPage } from "@/pages/Devices";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
