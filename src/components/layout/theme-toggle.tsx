import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeToggle(): JSX.Element {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  const handleChange = (value: string) => {
    const next = value as ThemeMode;
    setMode(next);
  };

  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-xs font-medium text-muted-foreground">
        {t("theme")}
      </span>
      <Select value={mode} onValueChange={handleChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{t("system")}</SelectItem>
          <SelectItem value="light">{t("light")}</SelectItem>
          <SelectItem value="dark">{t("dark")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
