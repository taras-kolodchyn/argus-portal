export interface AuthProfile {
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AuthContextValue {
  isEnabled: boolean;
  isLoading: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  profile: AuthProfile | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: (redirect?: boolean) => void;
}
