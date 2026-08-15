import { CardsSkeleton } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-40" />
      <CardsSkeleton count={4} />
    </div>
  );
}
