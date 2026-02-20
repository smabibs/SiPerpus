'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Library, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Suspense } from 'react';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (res.ok) {
                const next = searchParams.get('next') || '/';
                router.push(next);
                router.refresh();
            } else {
                setError(data.error || 'Login gagal');
            }
        } catch {
            setError('Koneksi gagal, coba lagi');
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
            padding: 20, position: 'relative', overflow: 'hidden',
        }}>
            {/* Blurred orbs background */}
            <div style={{
                position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(79,110,247,0.25) 0%, transparent 70%)',
                top: -100, left: -100, pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', width: 350, height: 350, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
                bottom: -80, right: -60, pointerEvents: 'none',
            }} />

            {/* Card */}
            <div style={{
                width: '100%', maxWidth: 420, position: 'relative', zIndex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                padding: '44px 40px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 64, height: 64, borderRadius: 18,
                        background: 'linear-gradient(135deg, #4F6EF7, #8B5CF6)',
                        boxShadow: '0 8px 24px rgba(79,110,247,0.5)',
                        marginBottom: 20,
                    }}>
                        <Library size={30} color="white" />
                    </div>
                    <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.5px' }}>
                        SiPERPUS
                    </h1>
                    <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                        Sistem Manajemen Perpustakaan
                    </p>
                </div>

                {/* Error alert */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                        color: '#FCA5A5', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <span>⚠</span> {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Email */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="admin@smabibs.sch.id"
                                required
                                autoComplete="email"
                                autoFocus
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '12px 14px 12px 40px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12, color: '#F8FAFC',
                                    fontSize: 14, outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(79,110,247,0.7)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                autoComplete="current-password"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '12px 44px 12px 40px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12, color: '#F8FAFC',
                                    fontSize: 14, outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(79,110,247,0.7)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(v => !v)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4 }}
                            >
                                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 8, padding: '13px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #4F6EF7, #8B5CF6)',
                            color: '#fff', fontWeight: 700, fontSize: 15,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                            boxShadow: '0 4px 18px rgba(79,110,247,0.45)',
                            opacity: loading ? 0.75 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        <LogIn size={17} />
                        {loading ? 'Masuk…' : 'Masuk'}
                    </button>
                </form>

                <p style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                    SiPERPUS © {new Date().getFullYear()} · SMA BIBS
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0F172A' }} />}>
            <LoginForm />
        </Suspense>
    );
}
