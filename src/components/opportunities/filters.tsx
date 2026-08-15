"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  UTILITY_TYPES,
} from "@/lib/domain/types";
import { humanizeToken } from "@/lib/format";

const ANY = "__any__";

/**
 * Filter bar for the opportunity explorer.
 *
 * Filters live in the URL so a filtered view is linkable and survives a reload —
 * important when the operator is comparing two slices of the same table.
 */
export function OpportunityFiltersBar({
  countries,
  languages,
}: {
  countries: string[];
  languages: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === ANY) next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.replace(`/opportunities?${next.toString()}`, { scroll: false });
      });
    },
    [params, router],
  );

  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of params.keys()) {
      if (key !== "sort" && key !== "dir") count += 1;
    }
    return count;
  }, [params]);

  const value = (key: string) => params.get(key) ?? "";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Field label="Keyword">
          <Input
            defaultValue={value("keyword")}
            placeholder="Search keywords…"
            onChange={(event) => setParam("keyword", event.target.value)}
          />
        </Field>

        <Field label="Country">
          <Select
            value={value("country") || ANY}
            onValueChange={(next) => setParam("country", next)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any country</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Language">
          <Select
            value={value("language") || ANY}
            onValueChange={(next) => setParam("language", next)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any language</SelectItem>
              {languages.map((language) => (
                <SelectItem key={language} value={language}>
                  {language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={value("status") || ANY}
            onValueChange={(next) => setParam("status", next)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              {OPPORTUNITY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {OPPORTUNITY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Utility type">
          <Select
            value={value("utilityType") || ANY}
            onValueChange={(next) => setParam("utilityType", next)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any type</SelectItem>
              {UTILITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {humanizeToken(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Decision">
          <Select
            value={value("decision") || ANY}
            onValueChange={(next) => setParam("decision", next)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any decision</SelectItem>
              {["BUILD", "INVESTIGATE", "WATCH", "REJECT"].map((decision) => (
                <SelectItem key={decision} value={decision}>
                  {decision}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Min volume">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={value("minSearchVolume")}
            placeholder="e.g. 1000"
            onChange={(event) => setParam("minSearchVolume", event.target.value)}
          />
        </Field>

        <Field label="Max difficulty">
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={value("maxKeywordDifficulty")}
            placeholder="e.g. 40"
            onChange={(event) => setParam("maxKeywordDifficulty", event.target.value)}
          />
        </Field>

        <Field label="Min CPC">
          <Input
            type="number"
            min={0}
            step="0.01"
            defaultValue={value("minCpc")}
            placeholder="e.g. 1.00"
            onChange={(event) => setParam("minCpc", event.target.value)}
          />
        </Field>

        <Field label="Min SERP weakness">
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={value("minSerpWeakness")}
            placeholder="0-100"
            onChange={(event) => setParam("minSerpWeakness", event.target.value)}
          />
        </Field>

        <Field label="Min score">
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={value("minOpportunityScore")}
            placeholder="0-100"
            onChange={(event) => setParam("minOpportunityScore", event.target.value)}
          />
        </Field>

        <div className="flex items-end">
          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams();
                const sort = params.get("sort");
                const dir = params.get("dir");
                if (sort) next.set("sort", sort);
                if (dir) next.set("dir", dir);
                startTransition(() => {
                  router.replace(`/opportunities?${next.toString()}`, { scroll: false });
                });
              }}
            >
              <X className="size-4" />
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>

      {pending ? (
        <p className="text-[11px] text-muted-foreground">Updating…</p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
