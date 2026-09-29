# หม่าล่าฟันตุตุ / MALA FAN TUTU — ระบบสั่งอาหารร้านบุฟเฟต์

## Stack
- Next.js (เวอร์ชันล่าสุด) **App Router** — ใช้ **JavaScript เท่านั้น ไม่ใช่ TypeScript** (ไฟล์ .js)
- Supabase (`@supabase/supabase-js`) — client อยู่ที่ `lib/supabaseClient.js`
- Deploy บน Vercel

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

ตั้งค่าใน `.env.local` (ห้าม commit) และใน Vercel > Settings > Environment Variables

## กฎสำคัญ: Dynamic Route params เป็น Promise
Next.js เวอร์ชันล่าสุด ค่า `params` ของ Dynamic Route (เช่น `app/order/[sessionId]/page.js`)
เป็น **Promise** ต้อง unwrap เสมอ

**Client Component** (`'use client'`) — ใช้ `use()` จาก React:

```js
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  const { sessionId } = use(params);
  // ...
}
```

**Server Component** — ใช้ `await`:

```js
export default async function Page({ params }) {
  const { sessionId } = await params;
}
```

ห้ามเขียน `params.sessionId` ตรง ๆ (จะ error / ได้ undefined)

## โครงสร้างตารางฐานข้อมูล (มีอยู่แล้วใน Supabase — ไม่ต้องสร้างใหม่)
ใช้อ้างอิงตลอดทั้งโปรเจกต์ ห้ามเดาชื่อคอลัมน์เพิ่มเอง

| ตาราง | คอลัมน์ |
|---|---|
| `sessions` | `id`, `table_number`, `adult_count`, `child_count`, `status`, `created_at` |
| `menu_categories` | `id`, `name`, `sort_order` |
| `menu_items` | `id`, `category_id`, `name` |
| `orders` | `id`, `session_id`, `table_number`, `items` (jsonb), `status`, `created_at` |

ความสัมพันธ์: `menu_items.category_id → menu_categories.id`, `orders.session_id → sessions.id`

## Routes
- `/` — หน้าแรก (ทดสอบ deploy)
- `/generate-qr` — สร้าง QR ของโต๊ะ (ยังไม่สร้าง)
- `/kitchen` — หน้าครัว (ยังไม่สร้าง)
- หน้าสั่งอาหารแบบ Dynamic Route — ขั้นตอนถัดไป
