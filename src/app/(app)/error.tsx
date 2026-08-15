"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Utility Factory route error", error);
  }, [error]);

  return (
    <ErrorState
      title="This screen could not be loaded"
      description={
        <>
          {error.message || "An unexpected error occurred."}
          {error.digest ? (
            <span className="mt-1 block font-mono text-[10px]">
              digest {error.digest}
            </span>
          ) : null}
        </>
      }
      onRetry={reset}
    />
  );
}
