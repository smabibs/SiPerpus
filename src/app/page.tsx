'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen, Users, BookMarked, AlertTriangle,
  TrendingUp, Clock, Star, ChevronRight, Layers, Trophy, RotateCcw,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalBooks: number;
  totalMembers: number;
  activeLoans: number;
  overdueLoans: number;
  totalFines: number;
  totalCopies: number;
  availableCopies: number;
  recentLoans: Loan[];
  overdueList: OverdueLoan[];
  booksBySubject: SubjectStat[];
  popularBooks: PopularBook[];
  loansByMonth: MonthStat[];
  topBorrowers: TopBorrower[];
  categoryDistribution: CategoryDist[];
  recentReturns: RecentReturn[];
}

interface TopBorrower {
  id: number; name: string; member_code: string;
  class: string; type: string; loan_count: number; active_count: number;
}
interface CategoryDist {
  name: string; total: number; total_copies: number;
}
interface RecentReturn {
  id: number; return_date: string; fine: number;
  book_title: string; member_name: string;
}

interface Loan {
  id: number;
  book_title: string;
  member_name: string;
  member_code: string;
  member_class: string;
  loan_date: string;
  due_date: string;
  computed_status: string;
}

interface OverdueLoan {
  id: number;
  book_title: string;
  book_isbn: string;
  member_name: string;
  member_code: string;
  member_class: string;
  due_date: string;
  days_overdue: number;
  total_fine: number;
}

interface SubjectStat {
  name: string;
  color: string;
  total: number;
  total_copies: number;
}

interface PopularBook {
  id: number;
  title: string;
  author: string;
  isbn: string;
  loan_count: number;
}

interface MonthStat {
  month: string;
  count: number;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRupiah(num: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    dipinjam: 'badge-blue',
    dikembalikan: 'badge-green',
    terlambat: 'badge-red',
  };
  const label: Record<string, string> = {
    dipinjam: 'Dipinjam',
    dikembalikan: 'Dikembalikan',
    terlambat: 'Terlambat',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{label[status] || status}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
      </div>
    );
  }

  const maxMonthCount = Math.max(...(stats?.loansByMonth.map(m => m.count) || [1]));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Selamat datang di Sistem Perpustakaan SMA — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Judul', value: stats?.totalBooks ?? 0, icon: BookOpen, color: '#4F6EF7', bg: 'rgba(79,110,247,0.15)' },
          { label: 'Total Eksemplar', value: stats?.totalCopies ?? 0, icon: Layers, color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
          { label: 'Anggota Aktif', value: stats?.totalMembers ?? 0, icon: Users, color: '#3FB950', bg: 'rgba(63,185,80,0.15)' },
          { label: 'Dipinjam', value: stats?.activeLoans ?? 0, icon: BookMarked, color: '#388BFD', bg: 'rgba(56,139,253,0.15)' },
          { label: 'Terlambat', value: stats?.overdueLoans ?? 0, icon: AlertTriangle, color: '#F85149', bg: 'rgba(248,81,73,0.15)' },
          { label: 'Total Denda', value: formatRupiah(stats?.totalFines ?? 0), icon: DollarSign, color: '#D29922', bg: 'rgba(210,153,34,0.15)' },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <div className="stat-icon" style={{ background: item.bg }}>
              <item.icon size={20} color={item.color} />
            </div>
            <div className="stat-info">
              <h3>{item.value}</h3>
              <p>{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Overdue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, marginBottom: 20 }}>
        {/* Monthly chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Peminjaman 6 Bulan Terakhir</h3>
          </div>
          {stats?.loansByMonth && stats.loansByMonth.length > 0 ? (
            <div>
              <div className="mini-bar-chart" style={{ height: 80 }}>
                {stats.loansByMonth.map((m) => (
                  <div
                    key={m.month}
                    className="mini-bar"
                    style={{ height: `${(m.count / maxMonthCount) * 100}%` }}
                    title={`${m.month}: ${m.count} peminjaman`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                {stats.loansByMonth.map((m) => (
                  <span key={m.month} style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {m.month.substring(5)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Belum ada data peminjaman
            </p>
          )}

          {/* Popular books */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Star size={14} color="var(--warning)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Buku Terpopuler</span>
            </div>
            {stats?.popularBooks?.map((book, i) => (
              <div key={book.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                borderBottom: i < (stats.popularBooks.length - 1) ? '1px solid var(--border-color)' : 'none'
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: 'rgba(79,110,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0
                }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{book.author}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{book.loan_count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue list */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#F85149" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Peminjaman Terlambat</h3>
            </div>
            <Link href="/loans?status=dipinjam" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Lihat Semua <ChevronRight size={13} />
            </Link>
          </div>
          {stats?.overdueList && stats.overdueList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stats.overdueList.map((loan) => (
                <div key={loan.id} style={{
                  background: 'rgba(248,81,73,0.05)',
                  border: '1px solid rgba(248,81,73,0.2)',
                  borderRadius: 8, padding: '10px 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loan.book_title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {loan.member_name} {loan.member_class ? `· ${loan.member_class}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#F85149', marginTop: 2 }}>
                      Jatuh tempo: {formatDate(loan.due_date)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="badge badge-red">{loan.days_overdue} hari</span>
                    {loan.total_fine > 0 && (
                      <div style={{ fontSize: 11, color: '#F85149', marginTop: 4 }}>
                        {formatRupiah(loan.total_fine)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <AlertTriangle size={32} />
              <h3>Tidak ada keterlambatan</h3>
              <p>Semua peminjaman dalam status baik</p>
            </div>
          )}
        </div>
      </div>

      {/* Subject stats + Recent loans */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        {/* Subjects */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookOpen size={15} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Koleksi per Mata Pelajaran</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats?.booksBySubject?.map((sub) => (
              <div key={sub.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: sub.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{sub.total_copies} eks</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent loans */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Peminjaman Terbaru</h3>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats?.recentLoans?.map((loan) => (
              <div key={loan.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loan.book_title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {loan.member_name} {loan.member_class ? `· ${loan.member_class}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <StatusBadge status={loan.computed_status} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDate(loan.loan_date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Borrowers + Recent Returns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 20 }}>
        {/* Top Peminjam */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Trophy size={15} color="#D29922" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Top Peminjam</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats?.topBorrowers?.map((b, i) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? 'rgba(210,153,34,0.2)' : i === 1 ? 'rgba(139,148,158,0.2)' : 'rgba(139,148,158,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: i === 0 ? '#D29922' : 'var(--text-muted)',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.class || b.type}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{b.loan_count}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>pinjaman</span>
                </div>
              </div>
            ))}
            {(!stats?.topBorrowers || stats.topBorrowers.length === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data</div>
            )}
          </div>
        </div>

        {/* Pengembalian Terbaru */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <RotateCcw size={15} color="#3FB950" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Pengembalian Terbaru</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats?.recentReturns?.map((r) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.book_title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.member_name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {r.fine > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: '#F85149' }}>{formatRupiah(r.fine)}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.return_date ? formatDate(r.return_date) : '-'}</div>
                </div>
              </div>
            ))}
            {(!stats?.recentReturns || stats.recentReturns.length === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada pengembalian</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
