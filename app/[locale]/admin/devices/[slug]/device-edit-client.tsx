"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Rocket,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { updateDevice } from "@/actions/admin/updateDevice";
import { getClientAppCheckToken } from "@/lib/ai/client-app-check";
import type { AiExtractedDevice } from "@/lib/ai/extractSpecs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_PIPELINE = ["rumored", "announced", "upcoming", "available", "discontinued"] as const;

type Conf = "verified" | "estimated" | "unavailable" | "none";

const CONF_LABEL: Record<Conf, string> = {
  verified: "Verified",
  estimated: "Estimated",
  unavailable: "Unavailable",
  none: "Unset",
};

const CONF_VARIANT: Record<Conf, "success" | "warning" | "outline"> = {
  verified: "success",
  estimated: "warning",
  unavailable: "outline",
  none: "outline",
};

function Field({
  label,
  conf = "none",
  hint,
  children,
}: {
  label: string;
  conf?: Conf;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-xs font-medium text-foreground">
        {label}
        <Badge variant={CONF_VARIANT[conf]} className="px-1.5 py-0 text-[10px]">
          {CONF_LABEL[conf]}
        </Badge>
      </span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function num(value: number | null | undefined) {
  return value ?? "";
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn("h-8 rounded-lg text-sm", props.className)}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  step,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  step?: number;
}) {
  return (
    <TextInput
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      placeholder={placeholder}
      value={num(value)}
      onChange={(e) => onChange(parseNum(e.target.value))}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{placeholder ?? "Unknown"}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function BoolInput({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <select
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : e.target.value === "true")
      }
      className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">Unknown</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
}

function TagsEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <textarea
      rows={2}
      value={text}
      placeholder={placeholder ?? "comma-separated"}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export interface DeviceData {
  id: string;
  slug: string;
  brand: string;
  name: string;
  modelNumbers: string[];
  codename: string | null;
  status: string;
  announcedAt: string | null;
  releaseAt: string | null;
  specs: AiExtractedDevice["specs"];
  variants: {
    name: string;
    region: string;
    chipset: string | null;
    ramGb: number | null;
    storageGb: number | null;
    modem: string | null;
    note: string | null;
  }[];
  media: {
    heroImage: string | null;
    gallery: string[];
    renderImages: string[];
  };
  sources: {
    title: string;
    url: string;
    kind: string;
  }[];
}

function deviceToDraft(device: DeviceData): AiExtractedDevice {
  return {
    brand: device.brand,
    name: device.name,
    modelNumbers: device.modelNumbers,
    codename: device.codename,
    status: device.status as AiExtractedDevice["status"],
    announcedAt: device.announcedAt,
    releaseAt: device.releaseAt,
    specs: {
      ...device.specs,
      body: {
        ...device.specs.body,
        simConfig: (device.specs.body as Record<string, unknown>).simConfig as string | null ?? null,
      },
      display: {
        ...device.specs.display,
        touchSamplingRateHz: (device.specs.display as Record<string, unknown>).touchSamplingRateHz as number | null ?? null,
        alwaysOnDisplay: (device.specs.display as Record<string, unknown>).alwaysOnDisplay as boolean ?? false,
        ltpoGen: (device.specs.display as Record<string, unknown>).ltpoGen as string | null ?? null,
      },
      platform: {
        ...device.specs.platform,
        processNode: (device.specs.platform as Record<string, unknown>).processNode as string | null ?? null,
        npuTops: (device.specs.platform as Record<string, unknown>).npuTops as number | null ?? null,
      },
      battery: {
        ...device.specs.battery,
        adaptiveCharging: (device.specs.battery as Record<string, unknown>).adaptiveCharging as boolean ?? false,
        bypassCharging: (device.specs.battery as Record<string, unknown>).bypassCharging as boolean ?? false,
      },
      connectivity: {
        ...device.specs.connectivity,
        thread: (device.specs.connectivity as Record<string, unknown>).thread as boolean ?? false,
        matter: (device.specs.connectivity as Record<string, unknown>).matter as boolean ?? false,
        satelliteType: (device.specs.connectivity as Record<string, unknown>).satelliteType as string | null ?? null,
      },
      extras: {
        ...device.specs.extras,
        aiFeatures: (device.specs.extras as Record<string, unknown>).aiFeatures as string[] ?? [],
        boxContents: (device.specs.extras as Record<string, unknown>).boxContents as string[] ?? [],
        updatePolicy: (device.specs.extras as Record<string, unknown>).updatePolicy as string | null ?? null,
        sarValue: (device.specs.extras as Record<string, unknown>).sarValue as string | null ?? null,
      },
    },
    pricing: (device as unknown as Record<string, unknown>).pricing as AiExtractedDevice["pricing"] ?? { msrp: null, currentPrice: null, currency: "USD", region: null },
    software: (device as unknown as Record<string, unknown>).software as AiExtractedDevice["software"] ?? { osUpdateYears: null, securityUpdateYears: null, aiPlatform: null },
    variants: device.variants,
    images: {
      heroImage: device.media.heroImage,
      gallery: device.media.gallery,
      renderImages: device.media.renderImages,
    },
    confidence: { overall: 1, verifiedFields: [], estimatedFields: [], unavailableFields: [] },
    sources: device.sources.map((s) => ({
      title: s.title,
      url: s.url,
      kind: s.kind as AiExtractedDevice["sources"][number]["kind"],
    })),
  };
}

export function DeviceEditClient({
  device,
  locale,
}: {
  device: DeviceData;
  locale: string;
}) {
  const [draft, setDraft] = useState<AiExtractedDevice>(() => deviceToDraft(device));
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [saved, setSaved] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confMap = useMemo(() => {
    const map = new Map<string, Conf>();
    draft.confidence.verifiedFields.forEach((p) => map.set(p, "verified"));
    draft.confidence.estimatedFields.forEach((p) => map.set(p, "estimated"));
    draft.confidence.unavailableFields.forEach((p) => map.set(p, "unavailable"));
    return map;
  }, [draft]);

  const confOf = useCallback((path: string): Conf => confMap.get(path) ?? "none", [confMap]);

  const setDraftState = useCallback((mutator: (d: AiExtractedDevice) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
  }, []);

  const setSpec = useCallback(
    (section: string, field: string, value: unknown) => {
      setDraftState((d) => {
        (d.specs as unknown as Record<string, Record<string, unknown>>)[section][field] =
          value;
      });
    },
    [setDraftState],
  );

  async function onSave(publish: boolean) {
    setError(null);
    setSaving(publish ? "publish" : "draft");
    const token = await getClientAppCheckToken();
    const res = await updateDevice({
      slug: device.slug,
      draft,
      publish,
      appCheckToken: token,
    });
    setSaving(null);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setSaved({ slug: res.data.slug });
  }

  const cameraKinds = ["wide", "ultrawide", "telephoto", "periscope", "macro", "depth", "selfie"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Edit Device
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium">{device.brand} {device.name}</span>
            <span className="ml-2 text-muted-foreground/60">· {device.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link href={`/${locale}/admin/devices`}>
              ← Back to list
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={saving !== null}
            onClick={() => onSave(false)}
          >
            <Save className="size-4" />
            {saving === "draft" ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button disabled={saving !== null} onClick={() => onSave(true)}>
            <Rocket className="size-4" />
            {saving === "publish" ? <Loader2 className="size-4 animate-spin" /> : null}
            Publish
          </Button>
        </div>
      </section>

      {saved ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="size-5 text-success" />
          <span>
            Saved as{" "}
            <Link href={`/phone/${saved.slug}`} className="font-medium text-primary underline">
              {saved.slug}
            </Link>
            .
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSaved(null)}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="structured">
        <TabsList>
          <TabsTrigger value="structured">Structured form</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="structured" className="mt-4 space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identity & lifecycle</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Brand" conf={confOf("brand")}>
                <TextInput value={draft.brand} onChange={(e) => setDraftState((d) => { d.brand = e.target.value; })} placeholder="Samsung" />
              </Field>
              <Field label="Name" conf={confOf("name")}>
                <TextInput value={draft.name} onChange={(e) => setDraftState((d) => { d.name = e.target.value; })} placeholder="Galaxy S25 Ultra" />
              </Field>
              <Field label="Codename" conf={confOf("codename")}>
                <TextInput value={draft.codename ?? ""} onChange={(e) => setDraftState((d) => { d.codename = e.target.value || null; })} placeholder="eureka" />
              </Field>
              <Field label="Model numbers" conf={confOf("modelNumbers")}>
                <TagsEditor value={draft.modelNumbers} onChange={(v) => setDraftState((d) => { d.modelNumbers = v; })} placeholder="SM-S938U1, SM-S938B" />
              </Field>
              <Field label="Status pipeline" conf={confOf("status")}>
                <SelectInput
                  value={draft.status}
                  onChange={(v) => setDraftState((d) => { d.status = (v as AiExtractedDevice["status"]) ?? "rumored"; })}
                  options={STATUS_PIPELINE}
                  placeholder="rumored"
                />
              </Field>
              <Field label="Announced (ISO)" conf={confOf("announcedAt")}>
                <TextInput value={draft.announcedAt ?? ""} onChange={(e) => setDraftState((d) => { d.announcedAt = e.target.value || null; })} placeholder="2026-01-22" />
              </Field>
              <Field label="Release (ISO)" conf={confOf("releaseAt")}>
                <TextInput value={draft.releaseAt ?? ""} onChange={(e) => setDraftState((d) => { d.releaseAt = e.target.value || null; })} placeholder="2026-02-07" />
              </Field>
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardHeader><CardTitle className="text-base">Body</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Width (mm)" conf={confOf("specs.body.dimensions.widthMm")}>
                <NumberInput value={draft.specs.body.dimensions?.widthMm ?? null} onChange={(v) => setSpec("body", "dimensions", { ...(draft.specs.body.dimensions ?? {}), widthMm: v })} />
              </Field>
              <Field label="Height (mm)" conf={confOf("specs.body.dimensions.heightMm")}>
                <NumberInput value={draft.specs.body.dimensions?.heightMm ?? null} onChange={(v) => setSpec("body", "dimensions", { ...(draft.specs.body.dimensions ?? {}), heightMm: v })} />
              </Field>
              <Field label="Depth (mm)" conf={confOf("specs.body.dimensions.depthMm")}>
                <NumberInput value={draft.specs.body.dimensions?.depthMm ?? null} onChange={(v) => setSpec("body", "dimensions", { ...(draft.specs.body.dimensions ?? {}), depthMm: v })} step={0.1} />
              </Field>
              <Field label="Weight (g)" conf={confOf("specs.body.weightG")}>
                <NumberInput value={draft.specs.body.weightG} onChange={(v) => setSpec("body", "weightG", v)} />
              </Field>
              <Field label="Build" conf={confOf("specs.body.build")}>
                <TextInput value={draft.specs.body.build ?? ""} onChange={(e) => setSpec("body", "build", e.target.value || null)} placeholder="Titanium frame, glass back" />
              </Field>
              <Field label="Protection" conf={confOf("specs.body.protection")}>
                <TextInput value={draft.specs.body.protection ?? ""} onChange={(e) => setSpec("body", "protection", e.target.value || null)} placeholder="Gorilla Glass Victus 3" />
              </Field>
              <Field label="IP rating" conf={confOf("specs.body.ipRating")}>
                <TextInput value={draft.specs.body.ipRating ?? ""} onChange={(e) => setSpec("body", "ipRating", e.target.value || null)} placeholder="IP68" />
              </Field>
              <Field label="Materials" conf={confOf("specs.body.materials")}>
                <TagsEditor value={draft.specs.body.materials} onChange={(v) => setSpec("body", "materials", v)} />
              </Field>
              <Field label="Colors" conf={confOf("specs.body.colors")}>
                <TagsEditor value={draft.specs.body.colors} onChange={(v) => setSpec("body", "colors", v)} />
              </Field>
            </CardContent>
          </Card>

          {/* Display */}
          <Card>
            <CardHeader><CardTitle className="text-base">Display</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Type" conf={confOf("specs.display.type")}>
                <SelectInput value={draft.specs.display.type} onChange={(v) => setSpec("display", "type", v)} options={["OLED", "AMOLED", "LTPO AMOLED", "LCD", "Mini-LED"]} />
              </Field>
              <Field label="Size (in)" conf={confOf("specs.display.sizeIn")}>
                <NumberInput value={draft.specs.display.sizeIn} onChange={(v) => setSpec("display", "sizeIn", v)} step={0.01} />
              </Field>
              <Field label="Resolution" conf={confOf("specs.display.resolution")}>
                <TextInput value={draft.specs.display.resolution ?? ""} onChange={(e) => setSpec("display", "resolution", e.target.value || null)} placeholder="3120×1440" />
              </Field>
              <Field label="PPI" conf={confOf("specs.display.ppi")}>
                <NumberInput value={draft.specs.display.ppi} onChange={(v) => setSpec("display", "ppi", v)} />
              </Field>
              <Field label="Refresh (Hz)" conf={confOf("specs.display.refreshRateHz")}>
                <NumberInput value={draft.specs.display.refreshRateHz} onChange={(v) => setSpec("display", "refreshRateHz", v)} />
              </Field>
              <Field label="Peak brightness (nits)" conf={confOf("specs.display.peakBrightnessNits")}>
                <NumberInput value={draft.specs.display.peakBrightnessNits} onChange={(v) => setSpec("display", "peakBrightnessNits", v)} />
              </Field>
              <Field label="PWM (Hz)" conf={confOf("specs.display.pwmHz")}>
                <NumberInput value={draft.specs.display.pwmHz} onChange={(v) => setSpec("display", "pwmHz", v)} />
              </Field>
              <Field label="Glass" conf={confOf("specs.display.glass")}>
                <TextInput value={draft.specs.display.glass ?? ""} onChange={(e) => setSpec("display", "glass", e.target.value || null)} />
              </Field>
              <Field label="Color depth" conf={confOf("specs.display.colorDepth")}>
                <TextInput value={draft.specs.display.colorDepth ?? ""} onChange={(e) => setSpec("display", "colorDepth", e.target.value || null)} placeholder="10-bit" />
              </Field>
              <Field label="HDR support" conf={confOf("specs.display.hdrSupport")}>
                <TagsEditor value={draft.specs.display.hdrSupport} onChange={(v) => setSpec("display", "hdrSupport", v)} placeholder="HDR10+, HDR Vivid" />
              </Field>
            </CardContent>
          </Card>

          {/* Platform */}
          <Card>
            <CardHeader><CardTitle className="text-base">Platform & performance</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="OS" conf={confOf("specs.platform.os")}>
                <TextInput value={draft.specs.platform.os ?? ""} onChange={(e) => setSpec("platform", "os", e.target.value || null)} placeholder="Android 16" />
              </Field>
              <Field label="UI" conf={confOf("specs.platform.ui")}>
                <TextInput value={draft.specs.platform.ui ?? ""} onChange={(e) => setSpec("platform", "ui", e.target.value || null)} placeholder="One UI 8" />
              </Field>
              <Field label="Chipset" conf={confOf("specs.platform.chipset")}>
                <TextInput value={draft.specs.platform.chipset ?? ""} onChange={(e) => setSpec("platform", "chipset", e.target.value || null)} placeholder="Snapdragon 8 Elite" />
              </Field>
              <Field label="CPU" conf={confOf("specs.platform.cpu")}>
                <TextInput value={draft.specs.platform.cpu ?? ""} onChange={(e) => setSpec("platform", "cpu", e.target.value || null)} />
              </Field>
              <Field label="GPU" conf={confOf("specs.platform.gpu")}>
                <TextInput value={draft.specs.platform.gpu ?? ""} onChange={(e) => setSpec("platform", "gpu", e.target.value || null)} />
              </Field>
              <Field label="AnTuTu v10" conf={confOf("specs.platform.antutuV10")}>
                <NumberInput value={draft.specs.platform.antutuV10} onChange={(v) => setSpec("platform", "antutuV10", v)} />
              </Field>
              <Field label="Geekbench single" conf={confOf("specs.platform.geekbench6.single")}>
                <NumberInput value={draft.specs.platform.geekbench6?.single} onChange={(v) => setSpec("platform", "geekbench6", { single: v, multi: draft.specs.platform.geekbench6?.multi ?? null })} />
              </Field>
              <Field label="Geekbench multi" conf={confOf("specs.platform.geekbench6.multi")}>
                <NumberInput value={draft.specs.platform.geekbench6?.multi} onChange={(v) => setSpec("platform", "geekbench6", { single: draft.specs.platform.geekbench6?.single ?? null, multi: v })} />
              </Field>
            </CardContent>
          </Card>

          {/* Memory */}
          <Card>
            <CardHeader><CardTitle className="text-base">Memory</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="RAM options (GB)" conf={confOf("specs.memory.ramOptions")}>
                <TagsEditor value={draft.specs.memory.ramOptions.map(String)} onChange={(v) => setSpec("memory", "ramOptions", v.map(parseNum).filter((n): n is number => n !== null))} placeholder="12, 16" />
              </Field>
              <Field label="Storage options (GB)" conf={confOf("specs.memory.storageOptions")}>
                <TagsEditor value={draft.specs.memory.storageOptions.map(String)} onChange={(v) => setSpec("memory", "storageOptions", v.map(parseNum).filter((n): n is number => n !== null))} placeholder="256, 512, 1024" />
              </Field>
              <Field label="Storage type" conf={confOf("specs.memory.storageType")}>
                <SelectInput value={draft.specs.memory.storageType} onChange={(v) => setSpec("memory", "storageType", v)} options={["UFS 2.2", "UFS 3.1", "UFS 4.0", "eMMC 5.1"]} />
              </Field>
              <Field label="Card slot" conf={confOf("specs.memory.cardSlot")}>
                <BoolInput value={draft.specs.memory.cardSlot} onChange={(v) => setSpec("memory", "cardSlot", v)} />
              </Field>
            </CardContent>
          </Card>

          {/* Cameras */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cameras</CardTitle>
              <CardDescription>One row per physical lens, rear then front.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(["rear", "front"] as const).map((position) => (
                <div key={position} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium capitalize">{position} cameras</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraftState((d) => {
                        d.specs.cameras[position].push({ kind: position === "front" ? "selfie" : "wide", megapixels: null, aperture: null, sensorSize: null, pixelSize: null, fieldOfViewDeg: null, opticalZoom: null, digitalZoom: null, stabilization: null, video: [] });
                      })}
                    >
                      <Plus className="size-4" /> Add
                    </Button>
                  </div>
                  {draft.specs.cameras[position].length === 0 ? (
                    <p className="text-xs text-muted-foreground">No {position} cameras recorded.</p>
                  ) : (
                    draft.specs.cameras[position].map((cam, i) => (
                      <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Kind" conf={confOf(`specs.cameras.${position}.${i}.kind`)}>
                          <SelectInput value={cam.kind} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].kind = (v as typeof cam.kind) ?? "wide"; })} options={cameraKinds} />
                        </Field>
                        <Field label="Megapixels" conf={confOf(`specs.cameras.${position}.${i}.megapixels`)}>
                          <NumberInput value={cam.megapixels} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].megapixels = v; })} />
                        </Field>
                        <Field label="Aperture" conf={confOf(`specs.cameras.${position}.${i}.aperture`)}>
                          <TextInput value={cam.aperture ?? ""} onChange={(e) => setDraftState((d) => { d.specs.cameras[position][i].aperture = e.target.value || null; })} placeholder="f/1.8" />
                        </Field>
                        <Field label="Stabilization" conf={confOf(`specs.cameras.${position}.${i}.stabilization`)}>
                          <SelectInput value={cam.stabilization} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].stabilization = (v as typeof cam.stabilization) ?? null; })} options={["OIS", "OIS+EIS", "EIS", "none"]} />
                        </Field>
                        <Field label="Optical zoom" conf={confOf(`specs.cameras.${position}.${i}.opticalZoom`)}>
                          <NumberInput value={cam.opticalZoom} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].opticalZoom = v; })} step={0.1} />
                        </Field>
                        <Field label="Sensor size" conf={confOf(`specs.cameras.${position}.${i}.sensorSize`)}>
                          <TextInput value={cam.sensorSize ?? ""} onChange={(e) => setDraftState((d) => { d.specs.cameras[position][i].sensorSize = e.target.value || null; })} placeholder="1/1.3&quot;" />
                        </Field>
                        <Field label="Field of view (°)" conf={confOf(`specs.cameras.${position}.${i}.fieldOfViewDeg`)}>
                          <NumberInput value={cam.fieldOfViewDeg} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].fieldOfViewDeg = v; })} />
                        </Field>
                        <Field label="Video" conf={confOf(`specs.cameras.${position}.${i}.video`)}>
                          <TagsEditor value={cam.video} onChange={(v) => setDraftState((d) => { d.specs.cameras[position][i].video = v; })} placeholder="8K@30, 4K@120" />
                        </Field>
                        <div className="flex items-end sm:col-span-2 lg:col-span-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDraftState((d) => { d.specs.cameras[position].splice(i, 1); })}
                          >
                            <Trash2 className="size-4" /> Remove lens
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Camera features" conf={confOf("specs.cameras.features")}>
                  <TagsEditor value={draft.specs.cameras.features} onChange={(v) => setSpec("cameras", "features", v)} placeholder="10x optical, Expert RAW" />
                </Field>
                <Field label="Video capabilities" conf={confOf("specs.cameras.videoCapabilities")}>
                  <TagsEditor value={draft.specs.cameras.videoCapabilities} onChange={(v) => setSpec("cameras", "videoCapabilities", v)} placeholder="8K@30fps, HDR10+ video" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Audio / Battery / Connectivity / Extras */}
          <Card>
            <CardHeader><CardTitle className="text-base">Audio</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Speakers" conf={confOf("specs.audio.speakers")}>
                <TagsEditor value={draft.specs.audio.speakers} onChange={(v) => setSpec("audio", "speakers", v)} />
              </Field>
              <Field label="Headphone jack" conf={confOf("specs.audio.headphoneJack")}>
                <BoolInput value={draft.specs.audio.headphoneJack} onChange={(v) => setSpec("audio", "headphoneJack", v)} />
              </Field>
              <Field label="Codecs" conf={confOf("specs.audio.codecs")}>
                <TagsEditor value={draft.specs.audio.codecs} onChange={(v) => setSpec("audio", "codecs", v)} />
              </Field>
              <Field label="Microphone" conf={confOf("specs.audio.microphone")}>
                <TextInput value={draft.specs.audio.microphone ?? ""} onChange={(e) => setSpec("audio", "microphone", e.target.value || null)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Battery</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Capacity (mAh)" conf={confOf("specs.battery.capacityMah")}>
                <NumberInput value={draft.specs.battery.capacityMah} onChange={(v) => setSpec("battery", "capacityMah", v)} />
              </Field>
              <Field label="Type" conf={confOf("specs.battery.type")}>
                <TextInput value={draft.specs.battery.type ?? ""} onChange={(e) => setSpec("battery", "type", e.target.value || null)} placeholder="Li-Ion" />
              </Field>
              <Field label="Charging (W)" conf={confOf("specs.battery.chargingWatts")}>
                <NumberInput value={draft.specs.battery.chargingWatts} onChange={(v) => setSpec("battery", "chargingWatts", v)} />
              </Field>
              <Field label="Charging time (min)" conf={confOf("specs.battery.chargingTimeMin")}>
                <NumberInput value={draft.specs.battery.chargingTimeMin} onChange={(v) => setSpec("battery", "chargingTimeMin", v)} />
              </Field>
              <Field label="Wireless (W)" conf={confOf("specs.battery.wirelessWatts")}>
                <NumberInput value={draft.specs.battery.wirelessWatts} onChange={(v) => setSpec("battery", "wirelessWatts", v)} />
              </Field>
              <Field label="Reverse wireless (W)" conf={confOf("specs.battery.reverseWirelessWatts")}>
                <NumberInput value={draft.specs.battery.reverseWirelessWatts} onChange={(v) => setSpec("battery", "reverseWirelessWatts", v)} />
              </Field>
              <Field label="Endurance (h)" conf={confOf("specs.battery.enduranceHours")}>
                <NumberInput value={draft.specs.battery.enduranceHours} onChange={(v) => setSpec("battery", "enduranceHours", v)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Connectivity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Wi-Fi" conf={confOf("specs.connectivity.wifi")}>
                <TextInput value={draft.specs.connectivity.wifi ?? ""} onChange={(e) => setSpec("connectivity", "wifi", e.target.value || null)} placeholder="Wi-Fi 7" />
              </Field>
              <Field label="Bluetooth" conf={confOf("specs.connectivity.bluetooth")}>
                <TextInput value={draft.specs.connectivity.bluetooth ?? ""} onChange={(e) => setSpec("connectivity", "bluetooth", e.target.value || null)} placeholder="Bluetooth 6.0" />
              </Field>
              <Field label="USB" conf={confOf("specs.connectivity.usb")}>
                <TextInput value={draft.specs.connectivity.usb ?? ""} onChange={(e) => setSpec("connectivity", "usb", e.target.value || null)} placeholder="USB-C 3.2" />
              </Field>
              <Field label="NFC" conf={confOf("specs.connectivity.nfc")}>
                <BoolInput value={draft.specs.connectivity.nfc} onChange={(v) => setSpec("connectivity", "nfc", v)} />
              </Field>
              <Field label="IR blaster" conf={confOf("specs.connectivity.irBlaster")}>
                <BoolInput value={draft.specs.connectivity.irBlaster} onChange={(v) => setSpec("connectivity", "irBlaster", v)} />
              </Field>
              <Field label="GNSS" conf={confOf("specs.connectivity.gnss")}>
                <TagsEditor value={draft.specs.connectivity.gnss} onChange={(v) => setSpec("connectivity", "gnss", v)} placeholder="GPS, GLONASS, Galileo" />
              </Field>
              <Field label="Bands" conf={confOf("specs.connectivity.bands")}>
                <TagsEditor value={draft.specs.connectivity.bands} onChange={(v) => setSpec("connectivity", "bands", v)} placeholder="n1, n77, n78, B28" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Sensors & extras</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Sensors" conf={confOf("specs.sensors")}>
                <TagsEditor value={draft.specs.sensors} onChange={(v) => setDraftState((d) => { d.specs.sensors = v; })} />
              </Field>
              <Field label="Fingerprint" conf={confOf("specs.extras.fingerprint")}>
                <SelectInput value={draft.specs.extras.fingerprint} onChange={(v) => setSpec("extras", "fingerprint", v)} options={["under-display", "side", "rear", "none"]} />
              </Field>
              <Field label="Face unlock" conf={confOf("specs.extras.faceUnlock")}>
                <BoolInput value={draft.specs.extras.faceUnlock} onChange={(v) => setSpec("extras", "faceUnlock", v)} />
              </Field>
              <Field label="Stylus" conf={confOf("specs.extras.stylus")}>
                <BoolInput value={draft.specs.extras.stylus} onChange={(v) => setSpec("extras", "stylus", v)} />
              </Field>
              <Field label="eSIM" conf={confOf("specs.extras.esim")}>
                <BoolInput value={draft.specs.extras.esim} onChange={(v) => setSpec("extras", "esim", v)} />
              </Field>
              <Field label="UWB" conf={confOf("specs.extras.uwb")}>
                <BoolInput value={draft.specs.extras.uwb} onChange={(v) => setSpec("extras", "uwb", v)} />
              </Field>
              <Field label="Satellite SOS" conf={confOf("specs.extras.satelliteSos")}>
                <BoolInput value={draft.specs.extras.satelliteSos} onChange={(v) => setSpec("extras", "satelliteSos", v)} />
              </Field>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regional variants</CardTitle>
              <CardDescription>SKU-level differences (chipset / RAM / storage / modem).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftState((d) => {
                  d.variants.push({ name: "", region: "Global", chipset: null, ramGb: null, storageGb: null, modem: null, note: null });
                })}
              >
                <Plus className="size-4" /> Add variant
              </Button>
              {draft.variants.length === 0 ? (
                <p className="text-xs text-muted-foreground">No regional variants recorded — the device will use the base spec sheet.</p>
              ) : (
                draft.variants.map((v, i) => (
                  <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Name">
                      <TextInput value={v.name ?? undefined} onChange={(e) => setDraftState((d) => { d.variants[i].name = e.target.value; })} placeholder="SM-S938U1" />
                    </Field>
                    <Field label="Region">
                      <TextInput value={v.region ?? undefined} onChange={(e) => setDraftState((d) => { d.variants[i].region = e.target.value; })} placeholder="US" />
                    </Field>
                    <Field label="Chipset">
                      <TextInput value={v.chipset ?? ""} onChange={(e) => setDraftState((d) => { d.variants[i].chipset = e.target.value || null; })} />
                    </Field>
                    <Field label="RAM (GB)">
                      <NumberInput value={v.ramGb} onChange={(x) => setDraftState((d) => { d.variants[i].ramGb = x; })} />
                    </Field>
                    <Field label="Storage (GB)">
                      <NumberInput value={v.storageGb} onChange={(x) => setDraftState((d) => { d.variants[i].storageGb = x; })} />
                    </Field>
                    <div className="flex items-end sm:col-span-2 lg:col-span-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDraftState((d) => { d.variants.splice(i, 1); })}
                      >
                        <Trash2 className="size-4" /> Remove variant
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw device JSON</CardTitle>
              <CardDescription>
                Current state of this device document as stored in Firestore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(draft, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
