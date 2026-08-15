"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Download } from "lucide-react";

import type { ActionState } from "@/app/actions/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Button that reflects the enclosing form's pending state. */
export function PendingButton({
  children,
  pendingLabel = "Working…",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * A form wrapping a single server action, with inline success/error feedback.
 * Used for the many one-button actions across the detail screens.
 */
export function ActionForm({
  action,
  hidden,
  children,
  className,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, {});

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <div className={className}>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        {Object.entries(hidden ?? {}).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        {children}
      </form>

      {state.error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.ok && state.message ? (
        <Alert variant="info" className="mt-2">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/** Destructive actions always require an explicit confirmation. */
export function ConfirmActionForm({
  action,
  hidden,
  title,
  description,
  confirmLabel,
  trigger,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  title: string;
  description: string;
  confirmLabel: string;
  trigger: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              {Object.entries(hidden ?? {}).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
              <AlertDialogAction type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {confirmLabel}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {state.error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
  variant = "outline",
}: {
  value: string;
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function DownloadButton({
  value,
  filename,
  label = "Export Markdown",
}: {
  value: string;
  filename: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        const blob = new Blob([value], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
