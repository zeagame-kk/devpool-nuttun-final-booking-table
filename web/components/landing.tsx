"use client";

import type { ReactNode } from "react";
import { Clock, MapPin, ShieldCheck, Star, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/bases/button";
import { Card, CardContent } from "@/components/ui/card";
import { startLogin } from "@/lib/auth";

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary-strong">{icon}</span>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

const STEPS = [
  { icon: <MapPin aria-hidden="true" />, title: "เลือกร้าน", text: "ค้นหาตามชื่อ หรือเรียงตามคะแนนและจำนวนรีวิว" },
  { icon: <Clock aria-hidden="true" />, title: "เลือกเวลา", text: "ดูช่วงที่ว่างรายชั่วโมง แล้วกดจองได้เลย" },
  { icon: <UtensilsCrossed aria-hidden="true" />, title: "ไปทานได้เลย", text: "ยกเลิกหรือเลื่อนได้ตามเวลาที่ร้านกำหนด" },
];

/** What a visitor who has not signed in sees. It calls no API: every restaurant endpoint needs a sign-in. */
export function Landing() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid items-center gap-6 md:grid-cols-2">
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-3xl leading-tight font-bold md:text-4xl">
            จองโต๊ะร้านชาบูและปิ้งย่าง
            <span className="block text-primary-strong">ดูช่วงว่างแล้วจองได้ทันที</span>
          </h1>
          <p className="text-muted-foreground">
            ไม่ต้องโทรถามว่าโต๊ะว่างไหม ดูที่นั่งที่เหลือรายชั่วโมง จอง แก้ หรือยกเลิกได้เอง และอ่านรีวิวก่อนตัดสินใจ
          </p>
          <Button size="large" onClick={startLogin}>
            เข้าสู่ระบบเพื่อจองโต๊ะ
          </Button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt="เนื้อย่างบนเตาร้อนที่มีไอน้ำลอยขึ้น"
          className="aspect-3/2 w-full rounded-2xl object-cover ring-1 ring-foreground/10"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">ทำไมต้อง Booking Table</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature icon={<Clock aria-hidden="true" />} title="ดูช่วงว่างก่อนจอง">
            เห็นที่นั่งที่เหลือของแต่ละชั่วโมง ไม่ต้องเดาว่าร้านเต็มหรือยัง
          </Feature>
          <Feature icon={<ShieldCheck aria-hidden="true" />} title="ไม่จองเกินที่นั่ง">
            ระบบตรวจคนที่อยู่ในร้านพร้อมกันจริง ๆ แม้มีคนกดจองพร้อมกัน
          </Feature>
          <Feature icon={<Star aria-hidden="true" />} title="รีวิวและคะแนน">
            ให้คะแนน 1–5 ดาวพร้อมข้อความ และเรียงร้านตามคะแนนเฉลี่ยได้
          </Feature>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">จองใน 3 ขั้นตอน</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-2xl bg-primary-subtle p-6 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-primary-strong">
          <Store aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">มีร้านของตัวเอง?</h2>
          <p className="text-sm text-muted-foreground">
            บัญชีเดียวเป็นได้ทั้งลูกค้าและเจ้าของร้าน ตั้งเวลาเปิด จำนวนที่นั่ง และรูปร้าน แล้วรับการจองได้เลย
          </p>
        </div>
        <Button variant="outline" onClick={startLogin}>
          เข้าสู่ระบบเพื่อเปิดร้าน
        </Button>
      </section>
    </div>
  );
}
