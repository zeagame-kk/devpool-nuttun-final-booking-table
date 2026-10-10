"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { apiFetch } from "@/lib/api";
import type { Me } from "@/lib/types";
import { displayName } from "@/lib/user";

/** Who is signed in, with a short bio the person can edit. Name and email belong to the sign-in account. */
export function ProfileHeader({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const name = displayName(me);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // PUT replaces both fields, so the picture we already have is sent back untouched.
      await apiFetch("/users/me", { method: "PUT", body: { imageUrl: me.imageUrl, bio: bio.trim() || null } });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setBio(me.bio ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-border-subtle bg-card p-6">
      <UserAvatar name={name} imageUrl={me.imageUrl} size="xlarge" />
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold break-words">{name}</h1>
        <p className="text-sm break-all text-muted-foreground">{me.email}</p>
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2.5">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="เช่น ชอบชาบูน้ำดำ ไปกันทุกศุกร์" aria-label="แนะนำตัว" className="min-h-24" />
          <ErrorAlert error={error} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={close}>
              ยกเลิก
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${me.bio ? "" : "text-muted-foreground"}`}>
            {me.bio || "ยังไม่มีคำแนะนำตัว"}
          </p>
          <Button variant="outline" onClick={() => setEditing(true)}>
            แก้ไขคำแนะนำตัว
          </Button>
        </>
      )}
      <p className="border-t border-background pt-3 text-[13px] text-muted-foreground">ชื่อและอีเมลมาจากบัญชีที่ใช้เข้าสู่ระบบ แก้ไขที่นี่ไม่ได้</p>
    </div>
  );
}
