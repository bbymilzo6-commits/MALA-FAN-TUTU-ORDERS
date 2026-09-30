'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ACTIVE = ['received', 'cooking'];
const WAIT_WARN_MIN = 15; // รอเกินกี่นาทีให้ตัวเลขเวลาเป็นสีแดง
const SAFETY_REFRESH_MS = 60000; // ดึงข้อมูลซ้ำทุก 60 วินาที กันกรณี Realtime หลุดเงียบ ๆ

function sortOrders(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function parseItems(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState('connecting'); // connecting | live | offline
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({}); // { [orderId]: true } กันการกดซ้ำ
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);

  const fetchOrders = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('id, session_id, table_number, items, status, created_at')
      .in('status', ACTIVE)
      .order('created_at', { ascending: true });

    if (!mounted.current) return;
    if (fetchError) {
      setError(`โหลดออเดอร์ไม่สำเร็จ: ${fetchError.message}`);
      return;
    }
    setError('');
    setOrders(sortOrders(data || []));
    setLoaded(true);
  }, []);

  // โหลดครั้งแรก + Realtime
  useEffect(() => {
    mounted.current = true;
    fetchOrders();

    function applyChange(row) {
      setOrders((prev) => {
        const without = prev.filter((o) => o.id !== row.id);
        if (!ACTIVE.includes(row.status)) return without; // served/อื่น ๆ -> เอาออก
        return sortOrders([...without, row]);
      });
    }

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) =>
        applyChange(payload.new)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) =>
        applyChange(payload.new)
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setConnection('live');
          fetchOrders(); // ซิงก์ใหม่ เผื่อพลาดออเดอร์ตอนหลุดการเชื่อมต่อ
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setConnection('offline');
        }
      });

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  // ดึงข้อมูลซ้ำเป็นระยะ (safety net) + อัปเดตเวลา "รอมาแล้ว"
  useEffect(() => {
    const refresh = setInterval(fetchOrders, SAFETY_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [fetchOrders]);

  // กันหน้าจอดับ (ถ้าเบราว์เซอร์รองรับ)
  useEffect(() => {
    let lock = null;
    async function requestLock() {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* ไม่รองรับหรือถูกปฏิเสธ ข้ามไป */
      }
    }
    requestLock();
    document.addEventListener('visibilitychange', requestLock);
    return () => {
      document.removeEventListener('visibilitychange', requestLock);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  async function setStatus(order, nextStatus) {
    if (busy[order.id]) return;
    setBusy((b) => ({ ...b, [order.id]: true }));
    setError('');

    // อัปเดตหน้าจอทันที (optimistic)
    setOrders((prev) =>
      nextStatus === 'served'
        ? prev.filter((o) => o.id !== order.id)
        : prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
    );

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', order.id);

    if (updateError) {
      setError(`อัปเดตออเดอร์ไม่สำเร็จ: ${updateError.message}`);
      await fetchOrders(); // คืนค่าตามฐานข้อมูลจริง
    }
    setBusy((b) => {
      const { [order.id]: _removed, ...rest } = b;
      return rest;
    });
  }

  const waiting = orders.filter((o) => o.status === 'received').length;
  const cooking = orders.filter((o) => o.status === 'cooking').length;

  return (
    <main className="kt">
      <style>{css}</style>

      <header className="kt-header">
        <h1 className="kt-title">ครัว · MALA FAN TUTU</h1>
        <div className="kt-stats">
          <span className="kt-stat">รอทำ {waiting}</span>
          <span className="kt-stat kt-stat-cooking">กำลังทำ {cooking}</span>
          <span className={`kt-conn kt-conn-${connection}`}>
            <span className="kt-dot" aria-hidden="true" />
            {connection === 'live' ? 'เชื่อมต่อแล้ว' : connection === 'offline' ? 'หลุดการเชื่อมต่อ' : 'กำลังเชื่อมต่อ'}
          </span>
        </div>
      </header>

      {connection === 'offline' && (
        <p className="kt-banner" role="alert">
          การเชื่อมต่อขัดข้อง กำลังเชื่อมต่อใหม่ ออเดอร์ใหม่อาจยังไม่ขึ้น
        </p>
      )}
      {error && (
        <p className="kt-banner" role="alert">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="kt-empty">กำลังโหลดออเดอร์...</p>
      ) : orders.length === 0 ? (
        <p className="kt-empty">ยังไม่มีออเดอร์</p>
      ) : (
        <section className="kt-grid" aria-live="polite">
          {orders.map((order) => {
            const items = parseItems(order.items);
            const isCooking = order.status === 'cooking';
            const waited = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60000));
            return (
              <article key={order.id} className={`kt-card ${isCooking ? 'is-cooking' : 'is-received'}`}>
                <div className="kt-card-top">
                  <div className="kt-table">โต๊ะ {order.table_number}</div>
                  <div className="kt-badge">{isCooking ? 'กำลังทำ' : 'รอทำ'}</div>
                </div>

                <div className="kt-time">
                  สั่งเมื่อ {formatTime(order.created_at)} ·{' '}
                  <span className={waited >= WAIT_WARN_MIN ? 'kt-late' : ''}>รอมาแล้ว {waited} นาที</span>
                </div>

                <ul className="kt-items">
                  {items.length === 0 && <li className="kt-item">ไม่มีรายการ</li>}
                  {items.map((it, idx) => (
                    <li key={idx} className="kt-item">
                      <span className="kt-item-name">{it.name}</span>
                      <span className="kt-item-qty">× {it.quantity}</span>
                    </li>
                  ))}
                </ul>

                <div className="kt-actions">
                  <button
                    type="button"
                    className="kt-btn kt-btn-start"
                    onClick={() => setStatus(order, 'cooking')}
                    disabled={isCooking || !!busy[order.id]}
                  >
                    เริ่มทำ
                  </button>
                  <button
                    type="button"
                    className="kt-btn kt-btn-done"
                    onClick={() => setStatus(order, 'served')}
                    disabled={!!busy[order.id]}
                  >
                    จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

const css = `
.kt { min-height: 100vh; padding: 1rem 1.25rem 2rem; font-size: 1.25rem; }
.kt-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem 1.5rem; margin-bottom: 1rem; }
.kt-title { margin: 0; font-size: 2.2rem; font-weight: 800; }
.kt-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.kt-stat {
  padding: 0.4rem 1.1rem;
  font-size: 1.5rem;
  font-weight: 800;
  border-radius: 999px;
  color: #2a1206;
  background: linear-gradient(135deg, #fff3da, #e7cfb6);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}
.kt-stat-cooking { background: linear-gradient(135deg, #ffd166, #f59e0b); }
.kt-conn { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; color: var(--muted); }
.kt-dot { width: 0.85rem; height: 0.85rem; border-radius: 50%; background: #8a6f64; }
.kt-conn-live .kt-dot { background: #7fd67a; box-shadow: 0 0 10px rgba(127, 214, 122, 0.8); }
.kt-conn-offline { color: #ff9a92; }
.kt-conn-offline .kt-dot { background: var(--chili); box-shadow: 0 0 10px rgba(229, 40, 27, 0.8); }

.kt-banner {
  margin: 0 0 1rem;
  padding: 0.9rem 1.1rem;
  font-weight: 700;
  background: rgba(120, 20, 14, 0.7);
  border: 2px solid var(--chili);
  border-radius: 12px;
}
.kt-empty { margin: 6rem 0; text-align: center; font-size: 2.2rem; font-weight: 800; color: var(--muted); }

.kt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; align-items: start; }

.kt-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.1rem 1.25rem;
  border-radius: 18px;
  color: #1a0f0d;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  animation: kt-pop 0.55s cubic-bezier(0.2, 1.25, 0.4, 1) both;
}
.kt-card.is-received { background: linear-gradient(180deg, #fff6ea, #f3e3d0); border-left: 12px solid var(--chili); }
.kt-card.is-cooking {
  background: linear-gradient(180deg, #ffc95a, #f5a623);
  border-left: 12px solid #a85f00;
  animation: kt-pop 0.55s cubic-bezier(0.2, 1.25, 0.4, 1) both, kt-glow 2.4s ease-in-out 0.6s infinite;
}
@keyframes kt-pop {
  0% { opacity: 0; transform: scale(0.85) translateY(10px); box-shadow: 0 0 0 0 rgba(255, 122, 26, 0.9); }
  60% { box-shadow: 0 0 0 16px rgba(255, 122, 26, 0); }
  100% { opacity: 1; transform: none; }
}
@keyframes kt-glow {
  0%, 100% { box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 0 rgba(245, 166, 35, 0); }
  50% { box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 28px rgba(245, 166, 35, 0.7); }
}

.kt-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.kt-table { font-size: 3.6rem; font-weight: 900; line-height: 1.05; }
.kt-badge { padding: 0.3rem 0.9rem; font-size: 1.3rem; font-weight: 800; border-radius: 999px; background: #1a0f0d; color: #fff; }
.kt-time { font-size: 1.15rem; font-weight: 700; }
.kt-late { color: #b3140a; font-weight: 900; }
.kt-card.is-cooking .kt-late { color: #7a0d06; }

.kt-items { list-style: none; margin: 0.2rem 0; padding: 0; border-top: 2px solid rgba(26, 15, 13, 0.25); }
.kt-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.3;
  border-bottom: 1px dashed rgba(26, 15, 13, 0.3);
}
.kt-item-qty { flex: 0 0 auto; font-weight: 900; font-size: 1.9rem; }

.kt-actions { display: flex; gap: 0.6rem; margin-top: 0.3rem; }
.kt-btn {
  flex: 1;
  min-height: 64px;
  padding: 0 0.75rem;
  font: inherit;
  font-size: 1.4rem;
  font-weight: 800;
  border: 3px solid #1a0f0d;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease, box-shadow 0.2s ease;
}
.kt-btn:active:not(:disabled) { transform: scale(0.96); }
.kt-btn:focus-visible { outline: 4px solid var(--chili); }
.kt-btn-start { background: rgba(255, 255, 255, 0.35); color: #1a0f0d; }
.kt-btn-start:hover:not(:disabled) { background: rgba(255, 255, 255, 0.7); }
.kt-btn-done { background: #1a0f0d; color: #fff; }
.kt-btn-done:hover:not(:disabled) { background: #3a1d14; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4); }
.kt-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;
