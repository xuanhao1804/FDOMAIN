import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DirectoryLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-10 w-full" />
      </Card>

      <div className="space-y-2.5">
        <Skeleton className="h-6 w-52" />
        <Card className="h-[6rem] p-5" />
        <Card className="h-[6rem] p-5" />
        <Card className="h-[6rem] p-5" />
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-6 w-48" />
        <Card className="h-16 p-5" />
      </div>
    </div>
  );
}
