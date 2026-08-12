import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

import { Button } from "~/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
      <Link
        href="/projects"
        className="text-2xl font-semibold tracking-tight transition hover:text-primary"
      >
        Talking Head
      </Link>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link
          href="/schedule"
          className="hidden transition hover:text-foreground sm:inline"
        >
          Schedule
        </Link>
        <span className="hidden sm:inline">{session?.user?.email}</span>
        <Button
          variant="link"
          className="h-auto px-0 text-foreground"
          onClick={() => void signOut({ callbackUrl: "/" })}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
