'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    Barcode,
    BookMarked,
    Users,
    GraduationCap,
    FileBarChart2,
    Library,
    Settings,
    ScanLine,
    LogOut,
    Sun,
    Moon,
    ClipboardList,
    CalendarClock,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const navItems = [
    {
        section: 'Utama',
        items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        section: 'Koleksi',
        items: [
            { href: '/books', label: 'Katalog Buku', icon: BookOpen },
            { href: '/subjects', label: 'Mata Pelajaran', icon: GraduationCap },
            { href: '/barcode', label: 'Cetak Barcode', icon: Barcode },
        ],
    },
    {
        section: 'Sirkulasi',
        items: [
            { href: '/scan', label: 'Scan Barcode', icon: ScanLine },
            { href: '/loans', label: 'Peminjaman', icon: BookMarked },
            { href: '/reservations', label: 'Reservasi', icon: CalendarClock },
            { href: '/members', label: 'Anggota', icon: Users },
        ],
    },
    {
        section: 'Laporan',
        items: [
            { href: '/reports', label: 'Laporan', icon: FileBarChart2 },
        ],
    },
    {
        section: 'Sistem',
        items: [
            { href: '/audit', label: 'Audit Log', icon: ClipboardList },
            { href: '/settings', label: 'Pengaturan', icon: Settings },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [schoolName, setSchoolName] = useState('SiPERPUS');
    const [schoolLogo, setSchoolLogo] = useState('');

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(d => {
                if (d.school_name) setSchoolName(d.school_name);
                if (d.school_logo) setSchoolLogo(d.school_logo);
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/login', { method: 'DELETE' });
        router.push('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: schoolLogo ? 'transparent' : 'linear-gradient(135deg, #4F6EF7, #8B5CF6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, overflow: 'hidden',
                    }}>
                        {schoolLogo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={schoolLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <Library size={18} color="white" />
                        }
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <h1 style={{ whiteSpace: 'normal', lineHeight: 1.2, fontSize: 13, wordBreak: 'break-word' }}>{schoolName}</h1>
                        <p>Perpustakaan</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section}>
                        <p className="nav-section-label">{section.section}</p>
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <Icon size={17} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', gap: 2,
            }}>
                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'none', color: 'var(--text-secondary)', fontSize: 13.5,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    {theme === 'dark' ? <Sun size={15} style={{ color: '#F59E0B' }} /> : <Moon size={15} style={{ color: '#6366F1' }} />}
                    <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
                </button>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'none', color: 'var(--text-muted)', fontSize: 13.5,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    <LogOut size={15} style={{ color: '#EF4444' }} />
                    <span>Keluar</span>
                </button>
            </div>

            <div style={{
                padding: '10px 16px 14px',
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
            }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>SiPERPUS v1.0</div>
                <div>Sistem Manajemen Perpustakaan</div>
            </div>
        </aside>
    );
}
