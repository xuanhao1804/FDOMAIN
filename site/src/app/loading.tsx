import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div aria-busy="true" className="space-y-8">
      <Card className="p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.75fr)] lg:items-center lg:gap-10">
          <div className="space-y-4">
            <Skeleton className="h-5 w-44 rounded-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-12 w-full max-w-2xl" />
            <div className="flex gap-2.5 pt-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)] p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-44 p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-10 w-full" />
        </Card>
        <Card className="h-44 p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-10 w-full" />
        </Card>
      </div>
    </div>
  );
}
