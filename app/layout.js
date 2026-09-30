import './globals.css';
import { IBM_Plex_Sans_Thai, Noto_Serif_Thai } from 'next/font/google';

const sans = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const serif = Noto_Serif_Thai({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-serif',
});

export const metadata = {
  title: 'หม่าล่าฟันตุตุ / MALA FAN TUTU',
  description: 'ระบบสั่งอาหารร้านบุฟเฟต์ หม่าล่าฟันตุตุ',
};

export const viewport = {
  themeColor: '#fbf8f3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
