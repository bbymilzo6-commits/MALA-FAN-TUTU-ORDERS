import './globals.css';
import { Prompt } from 'next/font/google';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
  variable: '--font-prompt',
});

export const metadata = {
  title: 'หม่าล่าฟันตุตุ / MALA FAN TUTU',
  description: 'ระบบสั่งอาหารร้านบุฟเฟต์ หม่าล่าฟันตุตุ',
};

export const viewport = {
  themeColor: '#140a08',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>{children}</body>
    </html>
  );
}
