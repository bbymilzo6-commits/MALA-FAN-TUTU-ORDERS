'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

// ครอบหน้าที่เฉพาะพนักงานเข้าได้ (เช็กฝั่งหน้าเว็บเพื่อ UX เท่านั้น
// ความปลอดภัยจริงอยู่ที่ RLS ใน Supabase ดู supabase/staff-auth-rls.sql)
export default function StaffGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let active = true;
    const toLogin = () => router.replace(`/login?next=${encodeURIComponent(pathname)}`);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setEmail(data.session.user.email || '');
        setReady(true);
      } else {
        toLogin();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setEmail(session.user.email || '');
        setReady(true);
      } else {
        setReady(false);
        toLogin();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (!ready) {
    return (
      <main className="sg-wait">
        <style>{css}</style>
        <p>กำลังตรวจสอบสิทธิ์...</p>
      </main>
    );
  }

  return (
    <>
      <style>{css}</style>
      {children}
      {/* อยู่ท้ายหน้า ไม่ลอยทับจอ กันกดออกจากระบบโดยไม่ตั้งใจบนจอครัว */}
      <footer className="sg-bar">
        <span>{email}</span>
        <button type="button" onClick={handleLogout}>
          ออกจากระบบ
        </button>
      </footer>
    </>
  );
}

const css = `
.sg-wait { min-height: 100vh; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 1.25rem; }
.sg-wait p { animation: fade 0.8s ease infinite alternate; }
.sg-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; color: var(--muted); font-size: 1rem; }
.sg-bar button {
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 700;
  color: var(--fg);
  background: transparent;
  border: 2px solid #8a6f64;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.sg-bar button:hover { background: rgba(255, 255, 255, 0.1); }
`;
