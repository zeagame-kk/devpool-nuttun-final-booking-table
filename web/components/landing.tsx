"use client";

import { Button } from "@/components/bases/button";
import { startLogin } from "@/lib/auth";

const STEPS = [
  { title: "เลือกร้าน", text: "ค้นหาตามชื่อ หรือเรียงตามคะแนนและจำนวนรีวิว" },
  { title: "เลือกเวลา", text: "ดูช่วงที่ว่างรายชั่วโมง แล้วกดจองได้เลย ระบบตรวจที่นั่งให้ ไม่จองเกินที่นั่ง" },
  { title: "ไปทานได้เลย", text: "ยกเลิกหรือเลื่อนได้ตามเวลาที่ร้านกำหนด แล้วกลับมาให้คะแนนรีวิว" },
];

/** Made-up hours for the picture, so a visitor sees what "ช่วงว่าง" looks like before signing in. */
const SAMPLE = [
  { time: "18:00", note: "เหลือ 8 ที่", box: "border border-border", noteColor: "text-success" },
  { time: "19:00", note: "เหลือ 2 ที่", box: "border border-accent-border bg-accent-subtle", noteColor: "text-accent-strong" },
  { time: "20:00", note: "เต็ม", box: "bg-muted text-muted-foreground", noteColor: "" },
];

/** What a visitor who has not signed in sees. It calls no API: every restaurant endpoint needs a sign-in. */
export function Landing() {
  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col items-start gap-4 md:gap-5">
          <p className="text-[15px] font-semibold text-primary-strong">Find a table. Find your food.</p>
          <h1 className="text-[32px] leading-[1.3] font-bold md:text-[40px]">
            จองโต๊ะร้านชาบูและปิ้งย่าง
            <span className="block text-primary">ดูช่วงว่างแล้วจองได้ทันที</span>
          </h1>
          <p className="text-base leading-[1.7] text-muted-foreground md:text-lg">
            ไม่ต้องโทรถามว่าโต๊ะว่างไหม ดูที่นั่งที่เหลือรายชั่วโมง จอง แก้ หรือยกเลิกได้เอง และอ่านรีวิวก่อนตัดสินใจ
          </p>
          <Button size="large" className="mt-1" onClick={startLogin}>
            เข้าสู่ระบบเพื่อจองโต๊ะ
          </Button>
        </div>

        <div className="relative h-[300px] md:h-[420px]" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero.jpg" alt="" className="absolute top-0 left-0 h-[270px] w-[76%] rounded-[20px] object-cover md:h-[380px] md:w-[380px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing-hotpot.jpg"
            alt=""
            className="absolute right-0 bottom-0 size-[130px] rounded-[20px] border-[6px] border-background object-cover md:size-[220px]"
          />
          <div className="absolute bottom-0 left-3 flex w-[230px] flex-col gap-2 rounded-[14px] bg-card p-3.5 shadow-[0_8px_24px_rgba(26,28,32,0.12)] md:bottom-2 md:left-7 md:w-[250px]">
            <span className="text-[13px] text-muted-foreground">ตัวอย่างช่วงว่าง</span>
            <div className="grid grid-cols-3 gap-1.5">
              {SAMPLE.map((slot) => (
                <div key={slot.time} className={`rounded-lg px-2 py-1.5 text-xs ${slot.box}`}>
                  <div className="font-semibold">{slot.time}</div>
                  <div className={slot.noteColor}>{slot.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-card p-6">
              <span className="text-[28px] font-bold text-primary">{index + 1}</span>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-5 rounded-[20px] bg-surface-inverse px-6 py-7 text-surface-inverse-foreground md:flex-row md:items-center md:justify-between md:gap-6 md:px-9 md:py-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[22px] font-semibold">มีร้านของตัวเอง?</h2>
          <p className="text-[15px] text-surface-inverse-muted">
            บัญชีเดียวเป็นได้ทั้งลูกค้าและเจ้าของร้าน ตั้งเวลาเปิด จำนวนที่นั่ง และรูปร้าน แล้วรับการจองได้เลย
          </p>
        </div>
        <Button variant="outline" size="medium" className="h-12 shrink-0 border-card bg-card text-foreground hover:bg-card/90" onClick={startLogin}>
          เข้าสู่ระบบเพื่อเปิดร้าน
        </Button>
      </section>
    </div>
  );
}
