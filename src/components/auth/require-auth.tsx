import type { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

interface RequireAuthProps {
  children: JSX.Element;
}

export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isEnabled) {
    return children;
  }

  if (!auth.isReady || auth.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading session...
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
}
