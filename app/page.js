import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <h1>หม่าล่าฟันตุตุ / MALA FAN TUTU</h1>
      <p>ระบบสั่งอาหารร้านบุฟเฟต์ — เดือด ตุ ตุ แล้ว</p>
      <nav>
        <Link className="btn" href="/generate-qr">สร้าง QR โต๊ะ</Link>
        <Link className="btn ghost" href="/kitchen">หน้าครัว</Link>
      </nav>
    </main>
  );
}
