import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-32" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-96 w-64 shrink-0" />
        ))}
      </div>
    </div>
  );
}
