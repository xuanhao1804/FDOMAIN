import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div
      aria-busy="true"
      className="home-ambient-canvas flex min-h-[calc(100dvh-3.5rem)] w-full flex-1 flex-col items-center justify-center px-4 py-12"
    >
      <div className="mx-auto flex w-full max-w-xl -translate-y-4 flex-col items-center space-y-6">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-12 w-3/4 max-w-md" />
        <Skeleton className="h-5 w-4/5 max-w-sm" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
