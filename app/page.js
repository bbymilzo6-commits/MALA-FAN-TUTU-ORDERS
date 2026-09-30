import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="hero-page">
      {/* ชื่อร้านอยู่ในรูปแล้ว จึงซ่อน h1 ไว้ให้ Google และเครื่องอ่านหน้าจอยังอ่านได้ */}
      <h1 className="sr-only">หม่าล่าฟันตุตุ / MALA FAN TUTU</h1>

      <div className="hero">
        <Image
          className="hero-img"
          src="/banner-home.jpg"
          alt=""
          width={1376}
          height={768}
          sizes="100vw"
          priority
        />
        <div className="hero-content">
          <p className="hero-tag">ระบบสั่งอาหารร้านบุฟเฟต์ — เดือด ตุ ดุ แล้ว</p>
          <Link className="btn pulse" href="/generate-qr">สร้าง QR โต๊ะ</Link>
        </div>
      </div>

      <Link className="home-staff" href="/login">สำหรับพนักงาน</Link>
    </main>
  );
}
