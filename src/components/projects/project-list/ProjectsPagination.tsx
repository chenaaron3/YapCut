import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "~/components/ui/button";

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function ProjectsPagination({ page, pageCount, onPageChange }: Props) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Project pages"
      className="mt-8 flex items-center justify-center gap-3"
    >
      <Button
        type="button"
        variant="ember-ink"
        className="h-11 rounded-[16px] px-3 shadow-[4px_4px_0_#450E16] hover:shadow-none disabled:translate-none disabled:opacity-40 disabled:shadow-[4px_4px_0_#450E16]"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft data-icon="inline-start" />
        Prev
      </Button>
      <p className="ember-mono min-w-28 text-center text-[11px] tracking-[.14em] text-[#432E6F] uppercase">
        Page {page} of {pageCount}
      </p>
      <Button
        type="button"
        variant="ember-ink"
        className="h-11 rounded-[16px] px-3 shadow-[4px_4px_0_#450E16] hover:shadow-none disabled:translate-none disabled:opacity-40 disabled:shadow-[4px_4px_0_#450E16]"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
      >
        Next
        <ChevronRight data-icon="inline-end" />
      </Button>
    </nav>
  );
}
