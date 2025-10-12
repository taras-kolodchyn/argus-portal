import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { useLanguage } from "@/hooks/useLanguage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageToggle(): JSX.Element {
  const { t } = useTranslation();
  const { language, changeLanguage, languages } = useLanguage();

  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-xs font-medium text-muted-foreground">
        {t("language")}
      </span>
      <Select value={language} onValueChange={(value) => changeLanguage(value as typeof language)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
