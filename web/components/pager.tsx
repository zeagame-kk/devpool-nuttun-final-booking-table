import { Button } from "@/components/bases/button";

interface PagerProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

/** Previous / next with "page X of Y". Hidden when everything fits on one page. */
export function Pager({ page, total, limit, onChange }: PagerProps) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-4" aria-label="เปลี่ยนหน้า">
      <Button variant="outline" size="small" disabled={page <= 1} onClick={() => onChange(Math.min(page - 1, pages))}>
        ก่อนหน้า
      </Button>
      <span className="text-sm">
        หน้า {page} จาก {pages}
      </span>
      <Button variant="outline" size="small" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        ถัดไป
      </Button>
    </nav>
  );
}
