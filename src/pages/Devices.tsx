import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Device, DeviceStatus } from "@/hooks/useDashboardData";
import { useAddDevice, useDevices } from "@/hooks/useDashboardData";

const statusOrder: Record<DeviceStatus, number> = {
  online: 1,
  maintenance: 2,
  offline: 3,
};

const statusVariant: Record<DeviceStatus, "default" | "secondary" | "destructive"> = {
  online: "default",
  maintenance: "secondary",
  offline: "destructive",
};

export function DevicesPage(): JSX.Element {
  const { t } = useTranslation();
  const { data: devices, isLoading } = useDevices();
  const addDevice = useAddDevice();

  const [statusFilter, setStatusFilter] = useState<"all" | DeviceStatus>("all");
  const [serial, setSerial] = useState("");
  const [secret, setSecret] = useState("");
  const [open, setOpen] = useState(false);

  const filteredDevices = useMemo(() => {
    if (!devices) {
      return [] as Device[];
    }
    const list = statusFilter === "all"
      ? devices
      : devices.filter((device) => device.status === statusFilter);
    return [...list].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status],
    );
  }, [devices, statusFilter]);

  const resetForm = () => {
    setSerial("");
    setSecret("");
  };

  const handleAddDevice = async () => {
    if (!serial.trim() || !secret.trim()) {
      return;
    }
    await addDevice.mutateAsync({ serial: serial.trim(), secret: secret.trim() });
    resetForm();
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <CardTitle>{t("devices")}</CardTitle>
            <CardDescription>{t("search_devices")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("status_all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status_all")}</SelectItem>
                <SelectItem value="online">{t("status_online")}</SelectItem>
                <SelectItem value="maintenance">{t("status_maintenance")}</SelectItem>
                <SelectItem value="offline">{t("status_offline")}</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={(value) => {
              setOpen(value);
              if (!value) {
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>{t("add_device")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("add_device")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="serial">{t("serial")}</Label>
                    <Input
                      id="serial"
                      value={serial}
                      onChange={(event) => setSerial(event.target.value)}
                      placeholder="AQI-123"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="secret">{t("secret")}</Label>
                    <Input
                      id="secret"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                      placeholder="••••••••"
                      type="password"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={() => {
                      void handleAddDevice();
                    }}
                    disabled={addDevice.isPending}
                  >
                    {t("add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("refresh")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table_device")}</TableHead>
                  <TableHead>{t("table_location")}</TableHead>
                  <TableHead>{t("table_status")}</TableHead>
                  <TableHead>{t("table_last_seen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      {t("notifications_empty")}
                    </TableCell>
                  </TableRow>
                )}
                {filteredDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell>{device.location}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[device.status]}>
                        {t(`status_${device.status}` as const)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.lastSeen}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
