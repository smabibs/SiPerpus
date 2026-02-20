'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, BookMarked, X, RotateCcw, Filter, AlertTriangle, Package, CheckSquare } from 'lucide-react';

interface Loan {
    id: number;
    book_id: number;
    member_id: number;
    book_title: string;
    book_isbn: string;
    book_author: string;
    member_name: string;
    member_code: string;
    member_class: string;
    member_type: string;
    quantity: number;
    loan_date: string;
    due_date: string;
    return_date?: string;
    computed_status: string;
    computed_fine: number;
    fine: number;
    notes?: string;
}

interface Book { id: number; title: string; isbn?: string; available_copies: number; }
interface Member { id: number; name: string; member_id: string; class?: string; type: string; }
interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span style={{ flex: 1 }}>{t.message}</span>
                    <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
                </div>
            ))}
        </div>
    );
}

function formatDate(s: string) {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = { dipinjam: 'badge-blue', dikembalikan: 'badge-green', terlambat: 'badge-red' };
    const label: Record<string, string> = { dipinjam: 'Dipinjam', dikembalikan: 'Dikembalikan', terlambat: 'Terlambat' };
    return <span className={`badge ${map[status] || 'badge-gray'}`}>{label[status] || status}</span>;
}

export default function LoansPage() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [borrowModal, setBorrowModal] = useState(false);
    const [returnConfirm, setReturnConfirm] = useState<Loan | null>(null);
    const [returnQty, setReturnQty] = useState(1);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [saving, setSaving] = useState(false);
    const [bookSearch, setBookSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [loanDays, setLoanDays] = useState(7);
    const [loanQty, setLoanQty] = useState(1);
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [loanNotes, setLoanNotes] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkReturning, setBulkReturning] = useState(false);
    const limit = 15;

    const addToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchLoans = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit), status: filterStatus });
        const res = await fetch(`/api/loans?${params}`);
        const data = await res.json();
        setLoans(data.loans || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, filterStatus]);

    useEffect(() => { fetchLoans(); }, [fetchLoans]);

    useEffect(() => {
        if (bookSearch.length > 1) {
            fetch(`/api/books?search=${bookSearch}&limit=10`)
                .then(r => r.json())
                .then(d => setBooks(d.books || []));
        } else {
            setBooks([]);
        }
    }, [bookSearch]);

    useEffect(() => {
        if (memberSearch.length > 1) {
            fetch(`/api/members?search=${memberSearch}&limit=10`)
                .then(r => r.json())
                .then(d => setMembers(d.members || []));
        } else {
            setMembers([]);
        }
    }, [memberSearch]);

    const openReturnConfirm = (loan: Loan) => {
        setReturnConfirm(loan);
        setReturnQty(loan.quantity || 1); // Default to full return
    };

    const handleBorrow = async () => {
        if (!selectedBook || !selectedMember) { addToast('Pilih buku dan anggota terlebih dahulu', 'error'); return; }
        setSaving(true);
        const res = await fetch('/api/loans', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: selectedBook.id, member_id: selectedMember.id, loan_days: loanDays, quantity: loanQty, notes: loanNotes }),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            const qty = data.quantity || 1;
            addToast(`Peminjaman ${qty} eksemplar buku berhasil dicatat`);
            setBorrowModal(false);
            setSelectedBook(null); setSelectedMember(null); setBookSearch(''); setMemberSearch(''); setLoanNotes(''); setLoanQty(1);
            fetchLoans();
        } else {
            addToast(data.error || 'Gagal mencatat peminjaman', 'error');
        }
    };

    const handleReturn = async () => {
        if (!returnConfirm) return;
        const res = await fetch('/api/loans', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: returnConfirm.id, action: 'return', return_quantity: returnQty }),
        });
        const data = await res.json();
        if (res.ok) {
            const fine = data.fine || 0;
            addToast(
                `"${returnConfirm.book_title}" (${returnQty} eks.) berhasil dikembalikan${fine > 0 ? ` — Denda: ${formatRupiah(fine)}` : ''}`
            );
            setReturnConfirm(null);
            fetchLoans();
        } else {
            addToast(data.error || 'Gagal mengembalikan buku', 'error');
        }
    };

    const totalPages = Math.ceil(total / limit);

    // Compute estimated fine for return modal
    const estimatedFine = (() => {
        if (!returnConfirm || returnConfirm.computed_status !== 'terlambat') return 0;
        const dueDate = new Date(returnConfirm.due_date);
        const today = new Date();
        const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays * 1000 * returnQty;
    })();

    const activeLoans = loans.filter(l => l.computed_status === 'dipinjam' || l.computed_status === 'terlambat');
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selectedIds.size === activeLoans.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(activeLoans.map(l => l.id)));
    };
    const handleBulkReturn = async () => {
        if (!confirm(`Kembalikan ${selectedIds.size} peminjaman yang dipilih?`)) return;
        setBulkReturning(true);
        try {
            const res = await fetch('/api/bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'return_loans', ids: Array.from(selectedIds) }),
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`${data.returned} peminjaman dikembalikan${data.total_fines > 0 ? ` — Total denda: ${formatRupiah(data.total_fines)}` : ''}`);
                setSelectedIds(new Set());
                fetchLoans();
            } else {
                addToast(data.error || 'Gagal mengembalikan', 'error');
            }
        } catch { addToast('Gagal mengembalikan', 'error'); }
        setBulkReturning(false);
    };

    return (
        <div>
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            <div className="page-header">
                <div>
                    <h1>Peminjaman Buku</h1>
                    <p>Kelola peminjaman dan pengembalian buku perpustakaan</p>
                </div>
                <button className="btn btn-primary" onClick={() => setBorrowModal(true)}>
                    <Plus size={16} /> Catat Peminjaman
                </button>
            </div>

            <div className="toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">Semua Status</option>
                        <option value="dipinjam">Dipinjam</option>
                        <option value="dikembalikan">Dikembalikan</option>
                        <option value="terlambat">Terlambat</option>
                    </select>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div style={{
                    background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)',
                    borderRadius: 10, padding: '10px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckSquare size={15} color="#3FB950" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} peminjaman dipilih</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>Batal</button>
                        <button className="btn btn-success btn-sm" onClick={handleBulkReturn} disabled={bulkReturning}>
                            <RotateCcw size={13} /> {bulkReturning ? 'Mengembalikan...' : 'Kembalikan Terpilih'}
                        </button>
                    </div>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 36 }}>
                                <input type="checkbox"
                                    checked={activeLoans.length > 0 && selectedIds.size === activeLoans.length}
                                    onChange={toggleSelectAll}
                                    style={{ cursor: 'pointer' }}
                                    title="Pilih semua peminjaman aktif"
                                />
                            </th>
                            <th>BUKU</th>
                            <th>ANGGOTA</th>
                            <th style={{ textAlign: 'center' }}>JML</th>
                            <th>TGL PINJAM</th>
                            <th>JATUH TEMPO</th>
                            <th>TGL KEMBALI</th>
                            <th>STATUS</th>
                            <th>DENDA</th>
                            <th>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={11}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                        ) : loans.length === 0 ? (
                            <tr><td colSpan={11}>
                                <div className="empty-state">
                                    <BookMarked size={40} />
                                    <h3>Belum ada data peminjaman</h3>
                                    <p>Klik &ldquo;Catat Peminjaman&rdquo; untuk memulai</p>
                                </div>
                            </td></tr>
                        ) : loans.map((loan, i) => {
                            const isActive = loan.computed_status === 'dipinjam' || loan.computed_status === 'terlambat';
                            return (
                                <tr key={loan.id} style={{ background: selectedIds.has(loan.id) ? 'rgba(79,110,247,0.06)' : undefined }}>
                                    <td>
                                        {isActive ? (
                                            <input type="checkbox" checked={selectedIds.has(loan.id)} onChange={() => toggleSelect(loan.id)} style={{ cursor: 'pointer' }} />
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(page - 1) * limit + i + 1}</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{loan.book_title}</div>
                                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{loan.book_isbn}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{loan.member_name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.member_code}{loan.member_class ? ` · ${loan.member_class}` : ''}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {(loan.quantity || 1) > 1 ? (
                                            <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Package size={11} />{loan.quantity} eks
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>1 eks</span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: 13 }}>{formatDate(loan.loan_date)}</td>
                                    <td style={{ fontSize: 13 }}>
                                        <span style={{ color: loan.computed_status === 'terlambat' ? 'var(--danger)' : 'inherit' }}>
                                            {formatDate(loan.due_date)}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 13 }}>{loan.return_date ? formatDate(loan.return_date) : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                    <td><StatusBadge status={loan.computed_status} /></td>
                                    <td style={{ fontSize: 13 }}>
                                        {(loan.fine || loan.computed_fine) > 0 ? (
                                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatRupiah(loan.fine || loan.computed_fine)}</span>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        {(loan.computed_status === 'dipinjam' || loan.computed_status === 'terlambat') && (
                                            <button className="btn btn-success btn-sm" onClick={() => openReturnConfirm(loan)}>
                                                <RotateCcw size={12} /> Kembalikan
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination">
                        <span>Menampilkan {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} dari {total} peminjaman</span>
                        <div className="pagination-buttons">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
                            <span style={{ padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{page}/{totalPages}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Borrow Modal */}
            {borrowModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBorrowModal(false); }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2>Catat Peminjaman Buku</h2>
                            <button className="btn-icon btn" onClick={() => setBorrowModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Book search */}
                            <div className="form-group">
                                <label className="form-label">Cari Buku *</label>
                                {selectedBook ? (
                                    <div style={{ background: 'rgba(79,110,247,0.1)', border: '1px solid rgba(79,110,247,0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedBook.title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {selectedBook.isbn} · Stok tersedia: <strong>{selectedBook.available_copies}</strong> eksemplar
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedBook(null); setBookSearch(''); setLoanQty(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Cari judul atau ISBN..." value={bookSearch} onChange={e => setBookSearch(e.target.value)} />
                                        {books.length > 0 && bookSearch.length > 1 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                                {books.map(b => (
                                                    <div key={b.id} onClick={() => { setSelectedBook(b); setBookSearch(''); setBooks([]); setLoanQty(1); }}
                                                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {b.isbn} · Stok: {b.available_copies}
                                                            {b.available_copies === 0 && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>HABIS</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Member search */}
                            <div className="form-group">
                                <label className="form-label">Cari Anggota *</label>
                                {selectedMember ? (
                                    <div style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedMember.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {selectedMember.member_id}{selectedMember.class ? ` · ${selectedMember.class}` : ''} · {selectedMember.type}
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedMember(null); setMemberSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Cari nama atau ID anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                                        {members.length > 0 && memberSearch.length > 1 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                                {members.map(m => (
                                                    <div key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setMembers([]); }}
                                                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {m.member_id}{m.class ? ` · ${m.class}` : ''} · {m.type}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Jumlah Eksemplar</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min={1}
                                        max={selectedBook ? selectedBook.available_copies : 20}
                                        value={loanQty}
                                        onChange={e => setLoanQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                    {selectedBook && loanQty > 1 && (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                            Sisa stok setelah dipinjam: {selectedBook.available_copies - loanQty} eks
                                        </div>
                                    )}
                                    {selectedBook && loanQty > selectedBook.available_copies && (
                                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                                            ⚠ Melebihi stok tersedia ({selectedBook.available_copies} eks)
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Lama Pinjam (Hari)</label>
                                    <input className="form-input" type="number" min={1} max={30} value={loanDays} onChange={e => setLoanDays(parseInt(e.target.value) || 7)} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Jatuh Tempo</label>
                                <input className="form-input" readOnly value={(() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + loanDays);
                                    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                                })()} style={{ color: 'var(--text-muted)' }} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Catatan</label>
                                <textarea className="form-textarea" style={{ minHeight: 60 }} value={loanNotes} onChange={e => setLoanNotes(e.target.value)} placeholder="Catatan opsional..." />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setBorrowModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleBorrow} disabled={saving || (!!selectedBook && loanQty > selectedBook.available_copies)}>
                                {saving ? 'Menyimpan...' : `Catat Peminjaman${loanQty > 1 ? ` (${loanQty} eks)` : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Confirm Modal */}
            {returnConfirm && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReturnConfirm(null); }}>
                    <div className="modal" style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h2>Konfirmasi Pengembalian</h2>
                            <button className="btn-icon btn" onClick={() => setReturnConfirm(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 14 }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 4px' }}>
                                    Kembalikan buku <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{returnConfirm.book_title}&rdquo;</strong>
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                                    Peminjam: <strong style={{ color: 'var(--text-primary)' }}>{returnConfirm.member_name}</strong>
                                    {returnConfirm.member_class ? ` · ${returnConfirm.member_class}` : ''}
                                </p>
                            </div>

                            {/* Quantity selector — only show when qty > 1 */}
                            {(returnConfirm.quantity || 1) > 1 && (
                                <div style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <Package size={15} color="var(--accent)" />
                                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                                            Jumlah Buku Dipinjam: {returnConfirm.quantity} eksemplar
                                        </span>
                                    </div>
                                    <label className="form-label" style={{ marginBottom: 6, fontSize: 13 }}>
                                        Jumlah yang Dikembalikan *
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setReturnQty(q => Math.max(1, q - 1))}
                                            style={{ width: 36, justifyContent: 'center', flexShrink: 0 }}
                                        >−</button>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min={1}
                                            max={returnConfirm.quantity}
                                            value={returnQty}
                                            onChange={e => setReturnQty(Math.min(returnConfirm.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                                            style={{ textAlign: 'center', width: 70 }}
                                        />
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setReturnQty(q => Math.min(returnConfirm.quantity, q + 1))}
                                            style={{ width: 36, justifyContent: 'center', flexShrink: 0 }}
                                        >+</button>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>dari {returnConfirm.quantity} eks</span>
                                    </div>
                                    {returnQty < returnConfirm.quantity && (
                                        <div style={{ fontSize: 12, color: 'var(--warning, #F59E0B)', marginTop: 8 }}>
                                            ⚠ Mengembalikan {returnQty} dari {returnConfirm.quantity} eks. Catatan: semua jumlah akan ditandai dikembalikan.
                                        </div>
                                    )}
                                </div>
                            )}

                            {returnConfirm.computed_status === 'terlambat' && (
                                <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 13 }}>Pengembalian Terlambat!</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                            Jatuh tempo: {formatDate(returnConfirm.due_date)}<br />
                                            Denda yang dikenakan{(returnConfirm.quantity || 1) > 1 ? ` (${returnQty} eks × Rp1.000/hari)` : ''}:{' '}
                                            <strong>{formatRupiah(estimatedFine)}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setReturnConfirm(null)}>Batal</button>
                            <button className="btn btn-success" onClick={handleReturn}>
                                <RotateCcw size={14} /> Kembalikan {(returnConfirm.quantity || 1) > 1 ? `${returnQty} Eks` : 'Buku'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
