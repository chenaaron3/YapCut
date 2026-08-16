export function ProjectsLoadingGrid() {
  return (
    <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-52 animate-pulse rounded-[24px] border-2 border-[#450E16]/20 bg-[#F5F9CE]"
        />
      ))}
    </ul>
  );
}
