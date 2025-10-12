import { useTranslation } from "react-i18next";

type SupportedLanguage = "en" | "uk";

export function useLanguage() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
  };

  return {
    language: (i18n.language as SupportedLanguage) ?? "en",
    changeLanguage,
    languages: [
      { code: "en" as const, label: "EN" },
      { code: "uk" as const, label: "UA" },
    ],
  };
}

