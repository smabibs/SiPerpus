'use client';

import { useEffect, useState } from 'react';
import { FileBarChart2, Download, BookOpen, Users, BookMarked, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface Stats {
    totalBooks: number;
    totalMembers: number;
    activeLoans: number;
    overdueLoans: number;
    totalFines: number;
    booksBySubject: { name: string; color: string; total: number; total_copies: number }[];
    popularBooks: { id: number; title: string; author: string; loan_count: number }[];
    loansByMonth: { month: string; count: number }[];
}

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

export default function ReportsPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats').then(r => r.json()).then(d => { setStats(d); setLoading(false); });
    }, []);


    if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div></div>;

    const monthNames: Record<string, string> = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
        '07': 'Jul', '08': 'Ags', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des',
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Laporan Perpustakaan</h1>
                    <p>Ringkasan data dan ekspor laporan</p>
                </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Total Judul Buku', value: stats?.totalBooks, icon: BookOpen, color: '#4F6EF7', bg: 'rgba(79,110,247,0.15)' },
                    { label: 'Anggota Aktif', value: stats?.totalMembers, icon: Users, color: '#3FB950', bg: 'rgba(63,185,80,0.15)' },
                    { label: 'Buku Dipinjam', value: stats?.activeLoans, icon: BookMarked, color: '#388BFD', bg: 'rgba(56,139,253,0.15)' },
                    { label: 'Terlambat', value: stats?.overdueLoans, icon: AlertTriangle, color: '#F85149', bg: 'rgba(248,81,73,0.15)' },
                ].map(item => (
                    <div key={item.label} className="stat-card">
                        <div className="stat-icon" style={{ background: item.bg }}>
                            <item.icon size={22} color={item.color} />
                        </div>
                        <div className="stat-info">
                            <h3>{item.value ?? 0}</h3>
                            <p>{item.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Export buttons */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <FileSpreadsheet size={16} color="#16A34A" />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ekspor Data ke Excel</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Download data dalam format <strong>.xlsx</strong> dengan format tabel yang rapi, siap cetak.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                        { href: '/api/export/books', label: 'Daftar Buku', color: '#1E3A8A', bg: 'rgba(30,58,138,0.08)', icon: BookOpen },
                        { href: '/api/export/members', label: 'Data Anggota', color: '#065F46', bg: 'rgba(6,95,70,0.08)', icon: Users },
                        { href: '/api/export/loans', label: 'Data Peminjaman', color: '#4C1D95', bg: 'rgba(76,29,149,0.08)', icon: BookMarked },
                    ].map(item => {
                        const Icon = item.icon;
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                download
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '9px 18px', borderRadius: 9,
                                    border: `1.5px solid ${item.color}44`,
                                    background: item.bg,
                                    color: item.color,
                                    fontWeight: 600, fontSize: 13.5,
                                    textDecoration: 'none',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${item.color}18`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.bg; }}
                            >
                                <Icon size={14} />
                                <Download size={13} />
                                {item.label}
                            </a>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Books by subject */}
                <div className="card">
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookOpen size={15} color="var(--accent)" /> Koleksi per Mata Pelajaran
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {stats?.booksBySubject?.map(sub => (
                            <div key={sub.name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: sub.color }} />
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{sub.name}</span>
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.total_copies} eks</span>
                                </div>
                                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3,
                                        background: sub.color,
                                        width: `${(sub.total_copies / Math.max(...(stats?.booksBySubject?.map(s => s.total_copies) || [1]))) * 100}%`,
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly loans */}
                <div className="card">
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookMarked size={15} color="var(--accent)" /> Peminjaman per Bulan
                    </h3>
                    {stats?.loansByMonth && stats.loansByMonth.length > 0 ? (
                        <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {stats.loansByMonth.map(m => {
                                    const [year, month] = m.month.split('-');
                                    const maxCount = Math.max(...stats.loansByMonth.map(x => x.count), 1);
                                    return (
                                        <div key={m.month}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {monthNames[month]} {year}
                                                </span>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.count} peminjaman</span>
                                            </div>
                                            <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${(m.count / maxCount) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '20px 0' }}>
                            <h3>Belum ada data</h3>
                        </div>
                    )}

                    {/* Total fines */}
                    {(stats?.totalFines ?? 0) > 0 && (
                        <div style={{ marginTop: 20, background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Total Denda Terhimpun</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#F85149' }}>{formatRupiah(stats?.totalFines || 0)}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
