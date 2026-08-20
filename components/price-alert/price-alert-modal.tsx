"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bell, Check, Loader2, Mail, MonitorSmartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";

interface PriceAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName: string;
  variantId: string;
  currentPrice: number;
}

export function PriceAlertModal({
  open,
  onOpenChange,
  deviceId,
  deviceName,
  variantId,
  currentPrice,
}: PriceAlertModalProps) {
  const [targetPrice, setTargetPrice] = React.useState<number>(
    Math.round(currentPrice * 0.85),
  );
  const [threshold, setThreshold] = React.useState(10);
  const [push, setPush] = React.useState(true);
  const [email, setEmail] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (currentPrice > 0) setTargetPrice(Math.round(currentPrice * 0.85));
  }, [currentPrice]);

  const subscribe = async () => {
    setStatus("submitting");
    setMessage("");
    try {
      const { subscribePriceAlert } = await import("@/actions/price-alerts");
      await subscribePriceAlert({
        deviceId,
        variantId,
        targetPriceUsd: targetPrice,
        thresholdPercent: threshold,
        channels: [push ? "push" : null, email ? "email" : null].filter(Boolean) as ("push" | "email")[],
      });
      setStatus("done");
      setTimeout(() => {
        onOpenChange(false);
        setStatus("idle");
      }, 1400);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error && err.message === "UNAUTHENTICATED"
          ? "Sign in to set price alerts."
          : "Something went wrong. Try again.",
      );
    }
  };

  const discount = currentPrice > 0 ? Math.round((1 - targetPrice / currentPrice) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Price alert</DialogTitle>
              <DialogDescription>{deviceName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {status === "done" ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2 py-8 text-center"
          >
            <Check className="h-10 w-10 text-success" />
            <p className="font-medium">Alert armed</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ll ping you at ${targetPrice} or below.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Target price</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Number(e.target.value))}
                    className="h-9 w-24 text-end font-mono"
                  />
                  <span className="text-sm text-muted-foreground">USD</span>
                </div>
              </div>
              <Slider
                min={Math.max(1, Math.round(currentPrice * 0.5))}
                max={currentPrice}
                step={1}
                value={[targetPrice]}
                onValueChange={([v]) => setTargetPrice(v)}
              />
              <p className="text-xs text-muted-foreground">
                {discount > 0 ? `~${discount}% below current ${formatCurrency(currentPrice)}` : "At or below current price"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Drop threshold</label>
                <span className="font-mono text-sm text-neon-cyan">{threshold}%</span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <MonitorSmartphone className="h-4 w-4 text-neon-cyan" /> Web push
                </label>
                <Switch checked={push} onCheckedChange={setPush} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-neon-cyan" /> Email
                </label>
                <Switch checked={email} onCheckedChange={setEmail} />
              </div>
            </div>

            {status === "error" && <p className="text-sm text-destructive">{message}</p>}
          </div>
        )}

        <DialogFooter>
          <Button onClick={subscribe} disabled={status === "submitting" || status === "done" || !(push || email)}>
            {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
            Arm alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
