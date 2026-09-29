import './globals.css';

export const metadata = {
  title: 'หม่าล่าฟันตุตุ / MALA FAN TUTU',
  description: 'ระบบสั่งอาหารร้านบุฟเฟต์ หม่าล่าฟันตุตุ',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
