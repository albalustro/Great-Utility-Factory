import { CardsSkeleton } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-24" />
      <CardsSkeleton count={6} />
    </div>
  );
}
