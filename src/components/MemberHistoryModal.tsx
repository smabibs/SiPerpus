'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, BookMarked, RotateCcw, AlertTriangle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface LoanHistory {
    id: number;
    book_title: string;
    book_isbn: string;
    quantity: number;
    loan_date: string;
    due_date: string;
    return_date: string | null;
    status: string;
    computed_status: string;
    fine: number;
}

interface MemberStats {
    total_loans: number;
    returned: number;
    active: number;
    overdue: number;
    total_fines: number;
}

interface MemberHistoryModalProps {
    member: { id: number; name: string; member_id: string; class?: string; type: string } | null;
    onClose: () => void;
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

export default function MemberHistoryModal({ member, onClose }: MemberHistoryModalProps) {
    const [loans, setLoans] = useState<LoanHistory[]>([]);
    const [stats, setStats] = useState<MemberStats>({ total_loans: 0, returned: 0, active: 0, overdue: 0, total_fines: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    const fetchHistory = useCallback(async () => {
        if (!member) return;
        setLoading(true);
        const res = await fetch(`/api/loans?member_id=${member.id}&page=${page}&limit=${limit}`);
        const data = await res.json();
        setLoans(data.loans || []);
        setTotal(data.total || 0);

        // Calculate stats from all loans
        const allRes = await fetch(`/api/loans?member_id=${member.id}&limit=1000`);
        const allData = await allRes.json();
        const allLoans = allData.loans || [];
        setStats({
            total_loans: allLoans.length,
            returned: allLoans.filter((l: LoanHistory) => l.status === 'dikembalikan').length,
            active: allLoans.filter((l: LoanHistory) => l.computed_status === 'dipinjam' || l.status === 'dipinjam').length,
            overdue: allLoans.filter((l: LoanHistory) => l.computed_status === 'terlambat').length,
            total_fines: allLoans.reduce((sum: number, l: LoanHistory) => sum + (l.fine || 0), 0),
        });
        setLoading(false);
    }, [member, page]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    if (!member) return null;

    const totalPages = Math.ceil(total / limit);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'var(--modal-backdrop, rgba(0,0,0,0.7))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 16, border: '1px solid var(--border-color)',
                width: '100%', maxWidth: 700, maxHeight: '85vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '18px 20px', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Riwayat Peminjaman
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            {member.name} ({member.member_id}){member.class ? ` — ${member.class}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4,
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 8, padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    {[
                        { label: 'Total', value: stats.total_loans, color: '#4F6EF7' },
                        { label: 'Dikembalikan', value: stats.returned, color: '#3FB950' },
                        { label: 'Aktif', value: stats.active, color: '#388BFD' },
                        { label: 'Terlambat', value: stats.overdue, color: '#F85149' },
                        { label: 'Denda', value: formatRupiah(stats.total_fines), color: '#D29922' },
                    ].map(s => (
                        <div key={s.label} style={{
                            textAlign: 'center', padding: '8px 4px',
                            background: 'var(--bg-tertiary)', borderRadius: 8,
                        }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                                {s.value}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Loan List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center' }}>
                            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, margin: '0 auto' }} />
                        </div>
                    ) : loans.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <BookMarked size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                            <div>Belum ada riwayat peminjaman</div>
                        </div>
                    ) : (
                        loans.map(loan => {
                            const isOverdue = loan.computed_status === 'terlambat';
                            const isActive = loan.status === 'dipinjam';
                            const isReturned = loan.status === 'dikembalikan';
                            return (
                                <div key={loan.id} style={{
                                    display: 'flex', gap: 12, padding: '12px 20px',
                                    borderBottom: '1px solid var(--border-color)',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isOverdue ? 'rgba(248,81,73,0.12)' :
                                            isReturned ? 'rgba(63,185,80,0.12)' : 'rgba(56,139,253,0.12)',
                                    }}>
                                        {isOverdue ? <AlertTriangle size={14} color="#F85149" /> :
                                            isReturned ? <RotateCcw size={14} color="#3FB950" /> :
                                                <BookMarked size={14} color="#388BFD" />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {loan.book_title}
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Calendar size={10} /> {formatDate(loan.loan_date)}
                                            </span>
                                            {loan.return_date && (
                                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                                    → {formatDate(loan.return_date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                            background: isOverdue ? 'rgba(248,81,73,0.12)' :
                                                isReturned ? 'rgba(63,185,80,0.12)' :
                                                    isActive ? 'rgba(56,139,253,0.12)' : 'rgba(139,148,158,0.12)',
                                            color: isOverdue ? '#F85149' :
                                                isReturned ? '#3FB950' :
                                                    isActive ? '#388BFD' : '#8B949E',
                                        }}>
                                            {isOverdue ? 'Terlambat' : isReturned ? 'Dikembalikan' : 'Dipinjam'}
                                        </span>
                                        {loan.fine > 0 && (
                                            <div style={{ fontSize: 11, color: '#F85149', marginTop: 3, fontWeight: 500 }}>
                                                {formatRupiah(loan.fine)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 20px', borderTop: '1px solid var(--border-color)',
                        fontSize: 12, color: 'var(--text-muted)',
                    }}>
                        <div>Hal {page} / {totalPages}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                                <ChevronLeft size={12} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                                <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
