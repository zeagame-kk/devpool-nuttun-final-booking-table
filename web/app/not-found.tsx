import Link from "next/link";
import { Armchair } from "lucide-react";
import { buttonVariants } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";

/** Shown for any URL that matches no page. */
export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md">
      <EmptyState
        icon={Armchair}
        title="404 — Table Not Found"
        description="ไม่พบหน้าที่คุณหา เหมือนโต๊ะที่หาไม่เจอ ลองกลับไปดูร้านทั้งหมด"
        action={
          <Link href="/" className={buttonVariants({ size: "small" })}>
            ดูร้านทั้งหมด
          </Link>
        }
      />
    </div>
  );
}
