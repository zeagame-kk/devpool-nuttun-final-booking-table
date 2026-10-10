"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <UserAvatar name={name} imageUrl={me.imageUrl} size="large" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <h1 className="truncate text-xl font-semibold">{name}</h1>
            <p className="truncate text-sm text-muted-foreground">{me.email}</p>
          </div>

          {editing ? (
            <form onSubmit={save} className="flex flex-col gap-2">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="แนะนำตัวสั้น ๆ"
                aria-label="แนะนำตัว"
              />
              <ErrorAlert error={error} />
              <div className="flex gap-2">
                <Button type="submit" size="small" disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                <Button type="button" variant="outline" size="small" disabled={saving} onClick={close}>
                  ยกเลิก
                </Button>
              </div>
            </form>
          ) : (
            <>
              {me.bio ? (
                <p className="whitespace-pre-wrap text-sm">{me.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีคำแนะนำตัว</p>
              )}
              <div>
                <Button variant="outline" size="small" onClick={() => setEditing(true)}>
                  แก้ไขคำแนะนำตัว
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">ชื่อและอีเมลมาจากบัญชีที่ใช้เข้าสู่ระบบ แก้ไขที่นี่ไม่ได้</p>
        </div>
      </CardContent>
    </Card>
  );
}
