import type { JSX } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  withText?: boolean;
  label?: string;
}

export function AppLogo({
  className,
  withText = false,
  label = "Argus Portal",
}: AppLogoProps): JSX.Element {
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-3 rounded-full px-2 py-1 text-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-semibold text-white shadow-md">
        A
      </span>
      {withText && (
        <span className="font-semibold tracking-tight sm:text-lg">{label}</span>
      )}
    </Link>
  );
}
