import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DevicesPage(): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("devices_title")}</CardTitle>
          <CardDescription>{t("devices_description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("devices_placeholder")}
        </CardContent>
      </Card>
    </div>
  );
}
