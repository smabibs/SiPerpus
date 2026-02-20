'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ScanLine, CheckCircle2, XCircle, BookOpen, User, ArrowRight, RotateCcw, Zap } from 'lucide-react';

type Mode = 'pinjam' | 'kembali';

interface BookInfo { id: number; isbn: string; title: string; author: string; available_copies: number; total_copies: number; subject_name?: string; }
interface MemberInfo { id: number; member_id: string; name: string; type: string; class?: string; status: string; active_loans: number; }
interface ResultData {
    ok: boolean;
    message: string;
    detail?: string;
    book_title?: string;
    member_name?: string;
    due_date?: string;
    fine?: number;
    days_late?: number;
}

const TYPE_LABEL: Record<string, string> = { siswa: 'Siswa', guru: 'Guru', staff: 'Staf' };

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function InfoCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: 'var(--bg-primary)', borderRadius: 12,
            border: `1.5px solid ${accent}44`,
            boxShadow: `0 0 0 3px ${accent}10`,
        }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{value}</div>
                {sub && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>}
            </div>
        </div>
    );
}

export default function ScanPage() {
    const [mode, setMode] = useState<Mode>('pinjam');

    // Scanned states
    const [memberInput, setMemberInput] = useState('');
    const [isbnInput, setIsbnInput] = useState('');
    const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
    const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
    const [memberError, setMemberError] = useState('');
    const [bookError, setBookError] = useState('');

    // Result
    const [result, setResult] = useState<ResultData | null>(null);
    const [processing, setProcessing] = useState(false);

    // Refs for auto-focus
    const memberRef = useRef<HTMLInputElement>(null);
    const isbnRef = useRef<HTMLInputElement>(null);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Focus first field on mode change / reset
    useEffect(() => {
        setTimeout(() => {
            if (mode === 'pinjam') memberRef.current?.focus();
            else isbnRef.current?.focus();
        }, 80);
    }, [mode]);

    const reset = useCallback(() => {
        setMemberInput(''); setIsbnInput('');
        setMemberInfo(null); setBookInfo(null);
        setMemberError(''); setBookError('');
        setResult(null); setProcessing(false);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        setTimeout(() => {
            if (mode === 'pinjam') memberRef.current?.focus();
            else isbnRef.current?.focus();
        }, 80);
    }, [mode]);

    // Auto-reset 8s after result shown
    useEffect(() => {
        if (result) {
            resetTimer.current = setTimeout(() => reset(), 8000);
        }
        return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
    }, [result, reset]);

    const lookupMember = async (code: string) => {
        setMemberError(''); setMemberInfo(null);
        if (!code.trim()) return;
        const res = await fetch(`/api/scan?member_code=${encodeURIComponent(code.trim())}`);
        const data = await res.json();
        if (!res.ok) { setMemberError(data.error); return; }
        setMemberInfo(data.data);
        // Move focus to ISBN field
        setTimeout(() => isbnRef.current?.focus(), 60);
    };

    const lookupBook = async (isbn: string) => {
        setBookError(''); setBookInfo(null);
        if (!isbn.trim()) return;
        const res = await fetch(`/api/scan?isbn=${encodeURIComponent(isbn.trim())}`);
        const data = await res.json();
        if (!res.ok) { setBookError(data.error); return; }
        setBookInfo(data.data);
    };

    const processTransaction = useCallback(async () => {
        if (processing) return;

        // Validate
        if (mode === 'pinjam') {
            if (!memberInfo && !memberInput.trim()) { setMemberError('Scan ID anggota terlebih dahulu'); memberRef.current?.focus(); return; }
            if (!bookInfo && !isbnInput.trim()) { setBookError('Scan ISBN buku terlebih dahulu'); isbnRef.current?.focus(); return; }
        } else {
            if (!isbnInput.trim() && !bookInfo) { setBookError('Scan ISBN buku terlebih dahulu'); isbnRef.current?.focus(); return; }
        }

        setProcessing(true);
        const payload = mode === 'pinjam'
            ? { action: 'pinjam', isbn: isbnInput.trim() || bookInfo?.isbn, member_code: memberInput.trim() || memberInfo?.member_id }
            : { action: 'kembali', isbn: isbnInput.trim() || bookInfo?.isbn };

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
                const loan = data.loan;
                if (data.action === 'pinjam') {
                    setResult({
                        ok: true,
                        message: 'Peminjaman Berhasil!',
                        detail: `Jatuh tempo: ${new Date(loan.due_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`,
                        book_title: loan.book_title,
                        member_name: loan.member_name,
                    });
                } else {
                    setResult({
                        ok: true,
                        message: data.fine > 0 ? `Dikembalikan — Ada Denda!` : 'Pengembalian Berhasil!',
                        detail: data.fine > 0
                            ? `Terlambat ${data.daysLate} hari · Denda: ${formatRupiah(data.fine)}`
                            : 'Buku dikembalikan tepat waktu',
                        book_title: loan.book_title,
                        member_name: loan.member_name,
                        fine: data.fine,
                        days_late: data.daysLate,
                    });
                }
            } else {
                setResult({ ok: false, message: 'Gagal', detail: data.error });
            }
        } catch {
            setResult({ ok: false, message: 'Error', detail: 'Koneksi gagal, coba lagi' });
        }
        setProcessing(false);
    }, [mode, memberInfo, bookInfo, memberInput, isbnInput, processing]);

    // Handle Enter in ISBN field for auto-submit (pinjam: only if member scanned; kembali: always)
    const handleIsbnEnter = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        const val = (e.target as HTMLInputElement).value.trim();
        if (!val) return;
        lookupBook(val).then(() => {
            if (mode === 'kembali' || memberInfo) {
                setTimeout(() => processTransaction(), 300);
            }
        });
    }, [mode, memberInfo, processTransaction]);

    const handleMemberEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) lookupMember(val);
    };

    const modeBtn = (m: Mode, label: string, color: string) => (
        <button
            onClick={() => { setMode(m); reset(); }}
            style={{
                flex: 1, padding: '14px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                background: mode === m ? color : 'var(--bg-tertiary)',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                boxShadow: mode === m ? `0 4px 14px ${color}44` : 'none',
            }}
        >
            {label}
        </button>
    );

    // ── Result Screen ──────────────────────────────────────────────────────
    if (result) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 20 }}>
                <div style={{
                    background: 'var(--bg-primary)', borderRadius: 24, padding: '40px 48px',
                    maxWidth: 480, width: '100%', textAlign: 'center',
                    border: `2px solid ${result.ok ? (result.fine && result.fine > 0 ? '#F59E0B' : '#22C55E') : '#EF4444'}22`,
                    boxShadow: `0 20px 60px ${result.ok ? '#22C55E' : '#EF4444'}18`,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        {result.ok
                            ? <CheckCircle2 size={64} color={result.fine && result.fine > 0 ? '#F59E0B' : '#22C55E'} />
                            : <XCircle size={64} color='#EF4444' />
                        }
                    </div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: result.ok ? (result.fine && result.fine > 0 ? '#D97706' : '#16A34A') : '#DC2626' }}>
                        {result.message}
                    </h2>
                    {result.detail && (
                        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>{result.detail}</p>
                    )}
                    {result.ok && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                            {result.book_title && (
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 16px', fontSize: 13, textAlign: 'left' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>BUKU</span>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{result.book_title}</div>
                                </div>
                            )}
                            {result.member_name && (
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 16px', fontSize: 13, textAlign: 'left' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>ANGGOTA</span>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{result.member_name}</div>
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={reset}
                            style={{
                                flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            <RotateCcw size={15} /> Scan Berikutnya
                        </button>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
                        Otomatis reset dalam 8 detik…
                    </p>
                </div>
            </div>
        );
    }

    // ── Main Scan Screen ───────────────────────────────────────────────────
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ScanLine size={24} color="var(--accent)" />
                        Scan Barcode
                    </h1>
                    <p>Scan barcode untuk proses peminjaman atau pengembalian buku</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Zap size={13} />
                    Siap menerima scan
                </div>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                {modeBtn('pinjam', '📤 Mode Peminjaman', '#2563EB')}
                {modeBtn('kembali', '📥 Mode Pengembalian', '#16A34A')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                {/* ── Left: Input Panel ─────────────────────── */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: mode === 'pinjam' ? '#2563EB' : '#16A34A', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                            {mode === 'pinjam' ? 'Scan Anggota → Scan Buku' : 'Scan Buku → Selesai'}
                        </span>
                    </div>

                    {/* Member ID input (pinjam only) */}
                    {mode === 'pinjam' && (
                        <div>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <User size={13} color="#2563EB" />
                                ID Anggota
                                {memberInfo && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#22C55E', fontWeight: 600 }}>✓ Terdeteksi</span>}
                            </label>
                            <input
                                ref={memberRef}
                                className="form-input"
                                placeholder="Scan barcode ID anggota…"
                                value={memberInput}
                                onChange={e => { setMemberInput(e.target.value); setMemberInfo(null); setMemberError(''); }}
                                onKeyDown={handleMemberEnter}
                                onBlur={e => { if (e.target.value.trim()) lookupMember(e.target.value.trim()); }}
                                style={{ borderColor: memberError ? '#EF4444' : memberInfo ? '#22C55E' : undefined, fontSize: 15 }}
                                autoComplete="off"
                            />
                            {memberError && <p style={{ color: '#EF4444', fontSize: 12, margin: '6px 0 0' }}>{memberError}</p>}
                        </div>
                    )}

                    {/* ISBN / Book barcode */}
                    <div>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <BookOpen size={13} color={mode === 'pinjam' ? '#2563EB' : '#16A34A'} />
                            ISBN Buku
                            {bookInfo && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#22C55E', fontWeight: 600 }}>✓ Terdeteksi</span>}
                        </label>
                        <input
                            ref={isbnRef}
                            className="form-input"
                            placeholder="Scan barcode buku (ISBN)…"
                            value={isbnInput}
                            onChange={e => { setIsbnInput(e.target.value); setBookInfo(null); setBookError(''); }}
                            onKeyDown={handleIsbnEnter}
                            onBlur={e => { if (e.target.value.trim()) lookupBook(e.target.value.trim()); }}
                            style={{ borderColor: bookError ? '#EF4444' : bookInfo ? '#22C55E' : undefined, fontSize: 15 }}
                            autoComplete="off"
                        />
                        {bookError && <p style={{ color: '#EF4444', fontSize: 12, margin: '6px 0 0' }}>{bookError}</p>}
                    </div>

                    {/* Process button */}
                    <button
                        onClick={processTransaction}
                        disabled={processing}
                        style={{
                            padding: '14px', borderRadius: 12, border: 'none', cursor: processing ? 'not-allowed' : 'pointer',
                            background: mode === 'pinjam' ? 'linear-gradient(135deg,#1D4ED8,#3B82F6)' : 'linear-gradient(135deg,#166534,#22C55E)',
                            color: '#fff', fontWeight: 700, fontSize: 15, opacity: processing ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            boxShadow: `0 4px 14px ${mode === 'pinjam' ? '#2563EB44' : '#16A34A44'}`,
                            transition: 'all 0.15s',
                        }}
                    >
                        <ArrowRight size={18} />
                        {processing ? 'Memproses…' : mode === 'pinjam' ? 'Proses Peminjaman' : 'Proses Pengembalian'}
                    </button>

                    <button
                        onClick={reset}
                        style={{ padding: '10px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                        <RotateCcw size={13} /> Reset
                    </button>
                </div>

                {/* ── Right: Preview Panel ──────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Member card */}
                    {mode === 'pinjam' && (
                        <div className="card" style={{ border: memberInfo ? '1.5px solid #22C55E33' : undefined }}>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Info Anggota
                            </p>
                            {memberInfo ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <InfoCard
                                        icon={<User size={16} color="#2563EB" />}
                                        label="Nama Anggota"
                                        value={memberInfo.name}
                                        sub={`${TYPE_LABEL[memberInfo.type] || memberInfo.type}${memberInfo.class ? ' · ' + memberInfo.class : ''}`}
                                        accent="#2563EB"
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID</div>
                                            <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{memberInfo.member_id}</div>
                                        </div>
                                        <div style={{ flex: 1, padding: '10px 14px', background: memberInfo.status === 'aktif' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: memberInfo.status === 'aktif' ? '#16A34A' : '#DC2626' }}>
                                                {memberInfo.status === 'aktif' ? '● Aktif' : '● Non-aktif'}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pinjaman</div>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{memberInfo.active_loans} aktif</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                    <User size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                    Belum ada anggota yang di-scan
                                </div>
                            )}
                        </div>
                    )}

                    {/* Book card */}
                    <div className="card" style={{ border: bookInfo ? '1.5px solid #22C55E33' : undefined }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Info Buku
                        </p>
                        {bookInfo ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <InfoCard
                                    icon={<BookOpen size={16} color={mode === 'pinjam' ? '#2563EB' : '#16A34A'} />}
                                    label="Judul Buku"
                                    value={bookInfo.title}
                                    sub={bookInfo.author || bookInfo.subject_name || ''}
                                    accent={mode === 'pinjam' ? '#2563EB' : '#16A34A'}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ISBN</div>
                                        <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{bookInfo.isbn}</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '10px 14px', background: bookInfo.available_copies > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok</div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: bookInfo.available_copies > 0 ? '#16A34A' : '#DC2626' }}>
                                            {bookInfo.available_copies} / {bookInfo.total_copies || '-'} eks
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                <BookOpen size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                Belum ada buku yang di-scan
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                            💡 {mode === 'pinjam' ? 'Cara Peminjaman' : 'Cara Pengembalian'}
                        </strong>
                        {mode === 'pinjam' ? (
                            <>
                                <div>1. Scan barcode ID Anggota (dari Kartu Anggota)</div>
                                <div>2. Scan barcode ISBN buku</div>
                                <div>3. Sistem otomatis proses saat Enter</div>
                            </>
                        ) : (
                            <>
                                <div>1. Scan barcode ISBN buku yang dikembalikan</div>
                                <div>2. Tekan Enter — sistem cari peminjaman aktif</div>
                                <div>3. Denda otomatis dihitung jika terlambat</div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
