import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "~/components/layout/BrandMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

function userInitials(name?: string | null, email?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  const local = email?.split("@")[0];
  if (local) return local.slice(0, 2).toUpperCase();
  return "?";
}

export function Navbar() {
  const { data: session } = useSession();
  const [imageFailed, setImageFailed] = useState(false);
  const user = session?.user;
  const image = user?.image && !imageFailed ? user.image : null;

  return (
    <header className="relative z-30 border-b border-[#F5F9CE]/20 bg-[#BC2D29] text-[#F5F9CE]">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-14"
      >
        <Link href="/projects" aria-label="YapCut home">
          <BrandMark light />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="relative size-10 overflow-hidden rounded-full border-2 border-[#450E16] bg-[#FFA102] text-sm font-bold text-[#450E16] shadow-[3px_3px_0_#450E16] outline-none hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:ring-2 focus-visible:ring-[#FFA102] focus-visible:ring-offset-2 focus-visible:ring-offset-[#BC2D29]"
                aria-label="Account menu"
              />
            }
          >
            {image ? (
              // Google profile URLs aren't in next/image remotePatterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="size-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
              />
            ) : (
              userInitials(user?.name, user?.email)
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="min-w-56 rounded-[16px] border-2 border-[#450E16] bg-[#F5F9CE] p-1 text-[#450E16] shadow-[4px_4px_0_#450E16] ring-0"
          >
            {user?.email ? (
              <>
                <p className="truncate px-2 py-1.5 text-sm text-[#432E6F]">
                  {user.email}
                </p>
                <DropdownMenuSeparator className="bg-[#450E16]/15" />
              </>
            ) : null}
            <DropdownMenuItem
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-[10px] focus:bg-[#FFA102] focus:text-[#450E16]"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
