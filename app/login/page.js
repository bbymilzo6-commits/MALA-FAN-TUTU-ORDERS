'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

// รับเฉพาะพาธภายในเว็บ กัน redirect ไปเว็บอื่น
function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/kitchen';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ล็อกอินอยู่แล้ว ไม่ต้องกรอกซ้ำ
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext());
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }
    router.replace(safeNext());
  }

  return (
    <main className="lg">
      <style>{css}</style>
      <form className="lg-card" onSubmit={handleSubmit}>
        <h1 className="lg-title">เข้าสู่ระบบพนักงาน</h1>
        <p className="lg-sub">หม่าล่าฟันตุตุ / MALA FAN TUTU</p>

        {error && (
          <p className="lg-error" role="alert">
            {error}
          </p>
        )}

        <label className="lg-field">
          <span>อีเมล</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="lg-field">
          <span>รหัสผ่าน</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="lg-btn" disabled={loading}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}

const css = `
.lg { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem 1.25rem; }
.lg-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem; border-radius: 16px; background: #2a1a16; }
.lg-title { margin: 0; font-size: 1.9rem; font-weight: 800; }
.lg-sub { margin: -0.5rem 0 0.25rem; color: var(--muted); }
.lg-field { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 700; font-size: 1.15rem; }
.lg-field input {
  width: 100%; padding: 0.8rem 1rem; font: inherit; font-size: 1.25rem;
  border: 2px solid #5a4038; border-radius: 12px; background: #fff; color: #1a0f0d;
}
.lg-field input:focus-visible { outline: 3px solid var(--chili); outline-offset: 2px; }
.lg-btn {
  min-height: 56px; font: inherit; font-size: 1.3rem; font-weight: 800; color: #fff;
  background: var(--chili); border: 2px solid var(--chili); border-radius: 12px; cursor: pointer;
}
.lg-btn:hover:not(:disabled) { background: var(--chili-dark); border-color: var(--chili-dark); }
.lg-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.lg-btn:focus-visible { outline: 3px solid var(--fg); outline-offset: 3px; }
.lg-error { margin: 0; padding: 0.75rem 1rem; font-weight: 700; background: #5b1410; border: 2px solid var(--chili); border-radius: 12px; }
`;
