import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <h1>หม่าล่าฟันตุตุ / MALA FAN TUTU</h1>
      <p>ระบบสั่งอาหารร้านบุฟเฟต์ — เดือด ตุ ดุ แล้ว</p>
      <nav>
        <Link className="btn" href="/generate-qr">สร้าง QR โต๊ะ</Link>
      </nav>
      <Link
        href="/login"
        style={{ marginTop: '2rem', color: 'var(--muted)', fontSize: '0.9rem', opacity: 0.7 }}
      >
        สำหรับพนักงาน
      </Link>
    </main>
  );
}
