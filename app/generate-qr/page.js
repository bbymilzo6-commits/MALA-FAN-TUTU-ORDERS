'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function toInt(value) {
  if (value === '') return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function minutesSince(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export default function GenerateQrPage() {
  const [table, setTable] = useState('');
  const [adult, setAdult] = useState('');
  const [child, setChild] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // session เดิมที่ยังเปิดค้างอยู่ (ถ้ามี)
  const [existing, setExisting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(0);

  // ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // กด Esc เพื่อยกเลิกกล่องยืนยัน
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, loading]);

  function handleTableChange(e) {
    setTable(e.target.value);
    // เปลี่ยนเลขโต๊ะแล้ว กล่องเตือนของโต๊ะเดิมไม่เกี่ยวข้องอีก
    setExisting(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');

    const tableNo = toInt(table);
    const adultNo = toInt(adult);
    const childNo = toInt(child);

    if (!(tableNo >= 1)) return setError('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
    if (!(adultNo >= 0) || !(childNo >= 0)) {
      return setError('กรุณากรอกจำนวนผู้ใหญ่และเด็ก (ถ้าไม่มีให้ใส่ 0)');
    }
    if (adultNo + childNo < 1) return setError('ต้องมีลูกค้าอย่างน้อย 1 คน');

    setLoading(true);
    try {
      // 1) เช็คว่าโต๊ะนี้มี session เปิดค้างอยู่หรือไม่
      const { data: openRows, error: checkError } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count, created_at')
        .eq('table_number', tableNo)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkError) throw checkError;

      if (openRows && openRows.length > 0) {
        setExisting(openRows[0]);
        return;
      }

      // 2) ไม่มี -> สร้าง session ใหม่
      const { error: insertError } = await supabase
        .from('sessions')
        .insert({
          table_number: tableNo,
          adult_count: adultNo,
          child_count: childNo,
          status: 'open',
        });

      if (insertError) {
        // 23505 = มีคนเปิดโต๊ะนี้ไปพร้อมกัน (unique index) -> แสดงกล่องเตือนตามปกติ
        if (insertError.code === '23505') {
          const { data: again } = await supabase
            .from('sessions')
            .select('id, adult_count, child_count, created_at')
            .eq('table_number', tableNo)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1);
          if (again && again.length > 0) {
            setExisting(again[0]);
            return;
          }
        }
        throw insertError;
      }

      setResult({
        table: tableNo,
        adult: adultNo,
        child: childNo,
        url: `${window.location.origin}/order/${tableNo}`,
      });
      setCopied(false);
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'}`);
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    setMinutesOpen(minutesSince(existing.created_at));
    setConfirmOpen(true);
  }

  async function handleConfirmClose() {
    if (loading || !existing) return;
    setLoading(true);
    setError('');
    try {
      // เช็คซ้ำว่ายังเป็น 'open' ตอน update เพื่อกันการกดซ้ำซ้อน
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .eq('status', 'open');
      // ไม่ใช้ .select() ต่อท้าย เพราะ RLS ของลูกค้า (anon) อ่านแถวที่ปิดแล้วไม่ได้

      if (updateError) throw updateError;

      // ถ้าไม่มีแถวถูกอัปเดต แปลว่ามีคนปิดไปก่อนแล้ว ผลลัพธ์ก็คือโต๊ะว่างเหมือนกัน
      setConfirmOpen(false);
      setExisting(null);
    } catch (err) {
      setConfirmOpen(false);
      setError(`ปิดโต๊ะเดิมไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      // fallback สำหรับเบราว์เซอร์ที่ไม่รองรับ clipboard API
      const ta = document.createElement('textarea');
      ta.value = result.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setTable('');
    setAdult('');
    setChild('');
    setExisting(null);
    setConfirmOpen(false);
    setResult(null);
    setError('');
    setCopied(false);
  }

  const qrSrc = result
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`
    : '';

  return (
    <main className="gq">
      <style>{css}</style>

      <h1 className="gq-title">เปิดโต๊ะ</h1>

      {result ? (
        <section className="gq-card gq-result" aria-live="polite">
          <img
            className="gq-qr"
            src={qrSrc}
            width={300}
            height={300}
            alt={`QR Code สำหรับโต๊ะ ${result.table}`}
          />
          <p className="gq-summary">
            โต๊ะ {result.table} · ผู้ใหญ่ {result.adult} · เด็ก {result.child}
          </p>
          <div className="gq-linkrow">
            <span className="gq-url">{result.url}</span>
            <button type="button" className="gq-btn gq-btn-small" onClick={handleCopy}>
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </button>
          </div>
          <button type="button" className="gq-btn gq-btn-wide" onClick={handleReset}>
            เปิดโต๊ะใหม่
          </button>
        </section>
      ) : (
        <>
          {existing && (
            <section className="gq-warn" role="alert">
              <p className="gq-warn-text">
                โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
              </p>
              <button
                type="button"
                className="gq-btn gq-btn-warn"
                onClick={openConfirm}
                disabled={loading}
              >
                ปิดออเดอร์เดิม
              </button>
            </section>
          )}

          {error && (
            <p className="gq-error" role="alert">
              {error}
            </p>
          )}

          <form className="gq-card" onSubmit={handleSubmit}>
            <label className="gq-field">
              <span>เลขโต๊ะ</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={table}
                onChange={handleTableChange}
                required
              />
            </label>
            <label className="gq-field">
              <span>จำนวนผู้ใหญ่</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={adult}
                onChange={(e) => setAdult(e.target.value)}
                required
              />
            </label>
            <label className="gq-field">
              <span>จำนวนเด็ก</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={child}
                onChange={(e) => setChild(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="gq-btn gq-btn-wide" disabled={loading}>
              {loading ? 'กำลังดำเนินการ...' : 'เปิดโต๊ะ'}
            </button>
          </form>
        </>
      )}

      {confirmOpen && existing && (
        <div className="gq-overlay" onClick={() => !loading && setConfirmOpen(false)}>
          <div
            className="gq-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gq-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="gq-dialog-title">ยืนยันปิดโต๊ะเดิม</h2>
            <p className="gq-dialog-line">โต๊ะ {toInt(table)}</p>
            <p className="gq-dialog-line">
              ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
            </p>
            <p className="gq-dialog-line">เปิดมาแล้ว {minutesOpen} นาที</p>
            <div className="gq-dialog-actions">
              <button
                type="button"
                className="gq-btn gq-btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="gq-btn gq-btn-warn"
                onClick={handleConfirmClose}
                disabled={loading}
              >
                {loading ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const css = `
.gq { max-width: 520px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; font-size: 1.25rem; }
.gq-title { margin: 0 0 1.25rem; font-size: 2.4rem; font-weight: 800; }
.gq-card { display: flex; flex-direction: column; gap: 1.1rem; padding: 1.35rem; }
.gq-field { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 700; }
.gq-field input { padding: 0.8rem 1rem; font-size: 1.75rem; }
.gq-btn { padding: 0.95rem 1.4rem; font-size: 1.35rem; }
.gq-btn-wide { width: 100%; }
.gq-btn-small { padding: 0.5rem 0.9rem; font-size: 1rem; white-space: nowrap; border-radius: 10px; }

.gq-warn {
  margin-bottom: 1rem;
  padding: 1.1rem 1.25rem;
  border: 2px solid var(--gold);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(122, 64, 8, 0.85), rgba(74, 42, 6, 0.9));
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.25);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  animation: gq-shake 0.5s ease both;
}
.gq-warn-text { margin: 0; font-size: 1.4rem; font-weight: 800; color: #ffd28a; }
@keyframes gq-shake {
  10%, 90% { transform: translateX(-2px); }
  30%, 70% { transform: translateX(5px); }
  50% { transform: translateX(-5px); }
}
.gq-error {
  margin: 0 0 1rem;
  padding: 0.9rem 1.1rem;
  border-radius: 12px;
  background: rgba(120, 20, 14, 0.7);
  border: 2px solid var(--chili);
  font-weight: 700;
}

.gq-result { align-items: center; text-align: center; }
.gq-qr {
  max-width: 100%;
  height: auto;
  padding: 10px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 0 0 4px var(--gold), 0 14px 40px rgba(0, 0, 0, 0.5), 0 0 34px rgba(229, 40, 27, 0.45);
  animation: gq-pop 0.55s cubic-bezier(0.2, 1.3, 0.4, 1) both;
}
@keyframes gq-pop { from { opacity: 0; transform: scale(0.7) rotate(-4deg); } to { opacity: 1; transform: none; } }
.gq-summary { margin: 0; font-size: 1.6rem; font-weight: 800; }
.gq-linkrow { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.6rem; }
.gq-url { font-size: 1.1rem; word-break: break-all; color: var(--muted); }

.gq-dialog { width: 100%; max-width: 460px; padding: 1.5rem; border: 3px solid var(--gold); }
.gq-dialog h2 { margin: 0 0 0.75rem; font-size: 1.7rem; color: #ffd28a; }
.gq-dialog-line { margin: 0.2rem 0; font-size: 1.4rem; font-weight: 700; }
.gq-dialog-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
.gq-dialog-actions .gq-btn { flex: 1 1 180px; }
`;
