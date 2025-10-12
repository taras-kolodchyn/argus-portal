import type { JSX } from "react";
import { Outlet } from "react-router-dom";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex w-full flex-col">
        <AppHeader />
        <main className="flex-1 bg-muted/30 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
