import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";

export function ProjectsBackLink() {
  return (
    <Button
      variant="ember-ghost"
      size="sm"
      nativeButton={false}
      render={<Link href="/projects" />}
      className="h-7 rounded-[10px] border-transparent px-2.5 text-xs hover:border-transparent"
    >
      <ChevronLeft className="size-3.5" />
      Projects
    </Button>
  );
}
