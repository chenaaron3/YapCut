import { Skeleton } from "~/components/ui/skeleton";

export function ProjectsLoadingGrid() {
  return (
    <ul
      className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <article className="overflow-hidden rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] shadow-[6px_7px_0_#450E16]">
            <div className="relative">
              <Skeleton className="h-36 w-full rounded-none sm:h-40" />
              <Skeleton className="absolute top-3 right-3 h-5 w-16 rounded-full" />
            </div>
            <div className="px-4 pt-3 pb-4">
              <Skeleton className="h-6 w-[58%]" />
              <Skeleton className="mt-2 h-2.5 w-[30%]" />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
