import { createContext, useContext } from "react";

import type { AuthContextValue } from "./auth-types";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export type { AuthContextValue } from "./auth-types";
export type { LoginCredentials, AuthProfile } from "./auth-types";
