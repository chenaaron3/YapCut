import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

import { BrandMark } from "~/components/layout/BrandMark";
import { cn } from "~/lib/utils";

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const onSchedule = router.pathname.startsWith("/schedule");

  return (
    <header className="relative z-30 border-b border-[#F5F9CE]/20 bg-[#BC2D29] text-[#F5F9CE]">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-14"
      >
        <Link href="/projects" aria-label="YapCut home">
          <BrandMark light />
        </Link>
        <div className="hidden items-center gap-8 text-sm font-semibold md:flex">
          <Link
            href="/projects"
            className={cn(
              "no-underline transition",
              onSchedule ? "opacity-75 hover:opacity-100" : "opacity-100",
            )}
          >
            Projects
          </Link>
          <Link
            href="/schedule"
            className={cn(
              "no-underline transition",
              onSchedule ? "opacity-100" : "opacity-75 hover:opacity-100",
            )}
          >
            Schedule
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="hidden max-w-[220px] truncate opacity-75 sm:inline">
            {session?.user?.email}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[16px] border-2 border-[#450E16] bg-[#FFA102] px-4 py-2.5 text-[#450E16] shadow-[4px_4px_0_#450E16] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
