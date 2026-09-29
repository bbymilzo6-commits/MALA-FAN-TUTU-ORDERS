'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ADULT_PRICE = 289;
const CHILD_PRICE = 145;
const MAX_QTY = 5; // จำนวนต่อรายการ
const MAX_LINES = 10; // จำนวนรายการต่อการส่ง 1 ครั้ง

export default function OrderPage({ params }) {
  // params เป็น Promise ใน Next.js เวอร์ชันล่าสุด ต้อง unwrap ด้วย use()
  const { tableNumber } = use(params);
  const tableNo = Number(tableNumber);
  const validTable = Number.isInteger(tableNo) && tableNo >= 1;

  // 'loading' | 'inactive' | 'active' | 'thanks' | 'error'
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');

  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sentMsg, setSentMsg] = useState('');

  const [billOpen, setBillOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [billError, setBillError] = useState('');

  // โหลด session ของโต๊ะนี้ + เมนู
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!validTable) {
        setStatus('inactive');
        return;
      }
      try {
        const { data: rows, error: sessionError } = await supabase
          .from('sessions')
          .select('id, adult_count, child_count')
          .eq('table_number', tableNo)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);
        if (sessionError) throw sessionError;
        if (cancelled) return;

        if (!rows || rows.length === 0) {
          setStatus('inactive');
          return;
        }

        const [catRes, itemRes] = await Promise.all([
          supabase
            .from('menu_categories')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true }),
          supabase
            .from('menu_items')
            .select('id, category_id, name')
            .order('id', { ascending: true }),
        ]);
        if (catRes.error) throw catRes.error;
        if (itemRes.error) throw itemRes.error;
        if (cancelled) return;

        setSession(rows[0]);
        setCategories(catRes.data || []);
        setItems(itemRes.data || []);
        setActiveCat(catRes.data && catRes.data.length > 0 ? catRes.data[0].id : null);
        setStatus('active');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'ไม่สามารถเชื่อมต่อได้');
        setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tableNo, validTable]);

  // ซ่อนข้อความ "ส่งออเดอร์แล้ว" หลัง 3 วินาที
  useEffect(() => {
    if (!sentMsg) return;
    const t = setTimeout(() => setSentMsg(''), 3000);
    return () => clearTimeout(t);
  }, [sentMsg]);

  function addToCart(item) {
    setCart((prev) => {
      const found = prev.find((l) => l.id === item.id);
      if (found) {
        if (found.quantity >= MAX_QTY) return prev;
        return prev.map((l) => (l.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, { id: item.id, name: item.name, quantity: 1 }];
    });
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.id !== id) return [l];
        const q = l.quantity + delta;
        if (q < 1) return [];
        return [{ ...l, quantity: Math.min(q, MAX_QTY) }];
      })
    );
  }

  async function submitOrder() {
    if (sending || cart.length === 0) return;
    setSending(true);
    setSendError('');
    try {
      // กันกรณีพนักงานปิดโต๊ะไปแล้วระหว่างที่ลูกค้าเลือกเมนู
      const { data: stillOpen, error: checkError } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', session.id)
        .eq('status', 'open')
        .limit(1);
      if (checkError) throw checkError;
      if (!stillOpen || stillOpen.length === 0) {
        setStatus('inactive');
        return;
      }

      const { error: insertError } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: tableNo,
        items: cart.map(({ name, quantity }) => ({ name, quantity })),
        status: 'received',
      });
      if (insertError) throw insertError;

      setCart([]);
      setCartOpen(false);
      setSentMsg('ส่งออเดอร์แล้ว');
    } catch (err) {
      setSendError(`ส่งออเดอร์ไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
    } finally {
      setSending(false);
    }
  }

  async function confirmBill() {
    if (closing || !session) return;
    setClosing(true);
    setBillError('');
    try {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open');
      if (updateError) throw updateError;

      setBillOpen(false);
      setCart([]);
      setStatus('thanks');
    } catch (err) {
      setBillError(`เรียกเก็บเงินไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
    } finally {
      setClosing(false);
    }
  }

  // ---------- หน้าเต็มจอ ----------
  if (status === 'loading') {
    return (
      <main className="od-full">
        <style>{css}</style>
        <p className="od-full-text">กำลังโหลด...</p>
      </main>
    );
  }

  if (status === 'inactive') {
    return (
      <main className="od-full">
        <style>{css}</style>
        <p className="od-full-text">โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="od-full">
        <style>{css}</style>
        <p className="od-full-text">โหลดข้อมูลไม่สำเร็จ</p>
        <p className="od-full-sub">{loadError}</p>
        <button type="button" className="od-btn" onClick={() => window.location.reload()}>
          ลองใหม่
        </button>
      </main>
    );
  }

  if (status === 'thanks') {
    return (
      <main className="od-full">
        <style>{css}</style>
        <p className="od-full-text">ขอบคุณที่ใช้บริการ</p>
        <p className="od-full-sub">หม่าล่าฟันตุตุ / MALA FAN TUTU</p>
      </main>
    );
  }

  // ---------- หน้าสั่งอาหาร ----------
  const visibleItems = items.filter((i) => i.category_id === activeCat);
  const totalBill = session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE;
  const cartFull = cart.length >= MAX_LINES;

  function qtyInCart(id) {
    const line = cart.find((l) => l.id === id);
    return line ? line.quantity : 0;
  }

  return (
    <main className="od">
      <style>{css}</style>

      <header className="od-header">
        <div>
          <div className="od-brand">MALA FAN TUTU</div>
          <div className="od-table">โต๊ะ {tableNo}</div>
        </div>
        <button
          type="button"
          className="od-btn od-btn-outline"
          onClick={() => {
            setBillError('');
            setBillOpen(true);
          }}
        >
          เรียกเก็บเงิน
        </button>
      </header>

      <nav className="od-tabs" aria-label="หมวดหมู่เมนู">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`od-tab ${c.id === activeCat ? 'is-active' : ''}`}
            aria-pressed={c.id === activeCat}
            onClick={() => setActiveCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <ul className="od-list">
        {visibleItems.length === 0 && <li className="od-empty">ยังไม่มีเมนูในหมวดนี้</li>}
        {visibleItems.map((item) => {
          const q = qtyInCart(item.id);
          return (
            <li key={item.id} className="od-item">
              <span className="od-item-name">{item.name}</span>
              {q === 0 ? (
                <button
                  type="button"
                  className="od-round"
                  aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
                  onClick={() => addToCart(item)}
                  disabled={cartFull}
                >
                  +
                </button>
              ) : (
                <div className="od-stepper">
                  <button
                    type="button"
                    className="od-round od-round-sm"
                    aria-label={`ลด ${item.name}`}
                    onClick={() => changeQty(item.id, -1)}
                  >
                    −
                  </button>
                  <span className="od-qty">{q}</span>
                  <button
                    type="button"
                    className="od-round od-round-sm"
                    aria-label={`เพิ่ม ${item.name}`}
                    onClick={() => addToCart(item)}
                    disabled={q >= MAX_QTY}
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {sentMsg && (
        <div className="od-toast" role="status">
          {sentMsg}
        </div>
      )}

      {/* ตะกร้าลอยด้านล่าง */}
      <div className="od-cart">
        {cartOpen && (
          <div className="od-cart-panel">
            {cart.length === 0 ? (
              <p className="od-cart-empty">ยังไม่ได้เลือกเมนู</p>
            ) : (
              <ul className="od-cart-list">
                {cart.map((l) => (
                  <li key={l.id} className="od-cart-line">
                    <span className="od-item-name">{l.name}</span>
                    <div className="od-stepper">
                      <button
                        type="button"
                        className="od-round od-round-sm"
                        aria-label={`ลด ${l.name}`}
                        onClick={() => changeQty(l.id, -1)}
                      >
                        −
                      </button>
                      <span className="od-qty">{l.quantity}</span>
                      <button
                        type="button"
                        className="od-round od-round-sm"
                        aria-label={`เพิ่ม ${l.name}`}
                        onClick={() => changeQty(l.id, 1)}
                        disabled={l.quantity >= MAX_QTY}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {cartFull && (
          <p className="od-cart-note">
            เลือกครบ {MAX_LINES} รายการแล้ว กรุณาส่งออเดอร์ก่อนสั่งเพิ่ม
          </p>
        )}
        {sendError && (
          <p className="od-cart-error" role="alert">
            {sendError}
          </p>
        )}

        <div className="od-cart-bar">
          <button
            type="button"
            className="od-cart-toggle"
            onClick={() => setCartOpen((v) => !v)}
            aria-expanded={cartOpen}
          >
            <span className="od-cart-count">{cart.length}</span>
            <span>รายการที่เลือก {cartOpen ? '▾' : '▴'}</span>
          </button>
          <button
            type="button"
            className="od-btn od-send"
            onClick={submitOrder}
            disabled={cart.length === 0 || sending}
          >
            {sending ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
          </button>
        </div>
      </div>

      {/* ยืนยันเรียกเก็บเงิน */}
      {billOpen && (
        <div className="od-overlay" onClick={() => !closing && setBillOpen(false)}>
          <div
            className="od-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="od-bill-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="od-bill-title">เรียกเก็บเงิน</h2>
            <p className="od-bill-line">
              ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE} ={' '}
              {(session.adult_count * ADULT_PRICE).toLocaleString('th-TH')} บาท
            </p>
            <p className="od-bill-line">
              เด็ก {session.child_count} × {CHILD_PRICE} ={' '}
              {(session.child_count * CHILD_PRICE).toLocaleString('th-TH')} บาท
            </p>
            <p className="od-bill-total">ยอดที่ต้องจ่าย {totalBill.toLocaleString('th-TH')} บาท</p>
            {cart.length > 0 && (
              <p className="od-bill-warn">มีรายการในตะกร้าที่ยังไม่ได้ส่ง หากเรียกเก็บเงินจะไม่ถูกส่งไปครัว</p>
            )}
            {billError && (
              <p className="od-cart-error" role="alert">
                {billError}
              </p>
            )}
            <div className="od-dialog-actions">
              <button
                type="button"
                className="od-btn od-btn-outline"
                onClick={() => setBillOpen(false)}
                disabled={closing}
              >
                ยกเลิก
              </button>
              <button type="button" className="od-btn" onClick={confirmBill} disabled={closing}>
                {closing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const css = `
.od, .od-full { --paper: #2a1a16; --line: #4a332c; }
.od {
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: 9rem;
  font-size: 1.15rem;
}
.od-full {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 1.5rem;
  text-align: center;
}
.od-full-text { margin: 0; font-size: 2rem; font-weight: 800; line-height: 1.3; }
.od-full-sub { margin: 0; color: var(--muted); }

.od-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.od-brand { font-size: 0.95rem; color: var(--muted); font-weight: 700; }
.od-table { font-size: 1.6rem; font-weight: 800; line-height: 1.2; }

.od-tabs {
  position: sticky;
  top: 68px;
  z-index: 15;
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.75rem 1rem;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  scrollbar-width: none;
}
.od-tabs::-webkit-scrollbar { display: none; }
.od-tab {
  flex: 0 0 auto;
  min-height: 48px;
  padding: 0 1.1rem;
  font: inherit;
  font-weight: 700;
  color: var(--fg);
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
}
.od-tab.is-active { background: var(--chili); border-color: var(--chili); color: #fff; }
.od-tab:focus-visible, .od-btn:focus-visible, .od-round:focus-visible, .od-cart-toggle:focus-visible {
  outline: 3px solid var(--fg);
  outline-offset: 2px;
}

.od-list { list-style: none; margin: 0; padding: 0.5rem 1rem; }
.od-empty { padding: 2rem 0; text-align: center; color: var(--muted); }
.od-item, .od-cart-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0;
  border-bottom: 1px dashed var(--line);
}
.od-item-name { flex: 1; font-weight: 700; line-height: 1.35; }

.od-round {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  font-size: 1.9rem;
  line-height: 1;
  font-weight: 700;
  color: #fff;
  background: var(--chili);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.od-round-sm { width: 44px; height: 44px; font-size: 1.6rem; }
.od-round:disabled { background: #5a4038; color: #9a857b; cursor: not-allowed; }
.od-stepper { display: flex; align-items: center; gap: 0.6rem; }
.od-qty { min-width: 1.5rem; text-align: center; font-size: 1.4rem; font-weight: 800; }

.od-btn {
  min-height: 48px;
  padding: 0 1.25rem;
  font: inherit;
  font-weight: 800;
  color: #fff;
  background: var(--chili);
  border: 2px solid var(--chili);
  border-radius: 12px;
  cursor: pointer;
}
.od-btn:hover:not(:disabled) { background: var(--chili-dark); border-color: var(--chili-dark); }
.od-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.od-btn-outline { background: transparent; color: var(--fg); border-color: #8a6f64; }
.od-btn-outline:hover:not(:disabled) { background: #3a2822; border-color: #8a6f64; }

.od-toast {
  position: fixed;
  left: 50%;
  bottom: 9.5rem;
  transform: translateX(-50%);
  z-index: 40;
  padding: 0.8rem 1.6rem;
  font-weight: 800;
  color: #10240f;
  background: #7fd67a;
  border-radius: 999px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.od-cart {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  max-width: 560px;
  margin: 0 auto;
  background: var(--paper);
  border-top: 2px solid var(--chili);
  border-radius: 18px 18px 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.od-cart-panel { max-height: 40vh; overflow-y: auto; padding: 0.25rem 1rem; }
.od-cart-list { list-style: none; margin: 0; padding: 0; }
.od-cart-empty { margin: 0; padding: 1rem 0; color: var(--muted); text-align: center; }
.od-cart-note { margin: 0; padding: 0.5rem 1rem 0; color: #ffd28a; font-weight: 700; font-size: 1rem; }
.od-cart-error { margin: 0; padding: 0.5rem 1rem 0; color: #ff9a92; font-weight: 700; font-size: 1rem; }
.od-cart-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; }
.od-cart-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 52px;
  padding: 0 0.25rem;
  font: inherit;
  font-weight: 700;
  color: var(--fg);
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
}
.od-cart-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.4rem;
  font-weight: 800;
  color: var(--bg);
  background: var(--fg);
  border-radius: 999px;
}
.od-send { min-height: 52px; padding: 0 1.6rem; font-size: 1.2rem; }

.od-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.75);
}
.od-dialog {
  width: 100%;
  max-width: 440px;
  padding: 1.5rem;
  background: var(--paper);
  border: 2px solid var(--chili);
  border-radius: 18px;
}
.od-dialog h2 { margin: 0 0 0.75rem; font-size: 1.7rem; }
.od-bill-line { margin: 0.25rem 0; color: var(--muted); }
.od-bill-total { margin: 0.9rem 0 0; font-size: 1.7rem; font-weight: 800; }
.od-bill-warn { margin: 0.75rem 0 0; color: #ffd28a; font-weight: 700; font-size: 1rem; }
.od-dialog-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
.od-dialog-actions .od-btn { flex: 1 1 140px; }
`;
