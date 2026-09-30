import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-flame" aria-hidden="true">🔥</div>
      <h1>หม่าล่าฟันตุตุ / MALA FAN TUTU</h1>
      <p>ระบบสั่งอาหารร้านบุฟเฟต์ — เดือด ตุ ดุ แล้ว</p>
      <nav>
        <Link className="btn pulse" href="/generate-qr">สร้าง QR โต๊ะ</Link>
      </nav>
      <Link className="home-staff" href="/login">สำหรับพนักงาน</Link>
    </main>
  );
}
