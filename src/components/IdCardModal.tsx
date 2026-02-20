'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Download, CreditCard } from 'lucide-react';

interface Member {
    id: number;
    member_id: string;
    name: string;
    type: string;
    class?: string;
    major?: string;
    phone?: string;
    email?: string;
    status: string;
    joined_at: string;
}

interface School {
    school_name: string;
    school_address: string;
    school_city: string;
    school_phone: string;
    school_logo: string;
}

interface Props {
    member: Member;
    school: School;
    onClose: () => void;
}

// Card dimensions (CR80 scale, 2x for hi-res)
const W = 638;  // 85.6mm at 96dpi × 2x ~= 638px (wider card)
const H = 408;  // 53.98mm at 96dpi × 2x ~= 408px

// Theme per type
const THEMES: Record<string, { from: string; to: string; accent: string; badge: string }> = {
    siswa: { from: '#1E3A8A', to: '#3B82F6', accent: '#BFDBFE', badge: 'ANGGOTA SISWA' },
    guru: { from: '#064E3B', to: '#10B981', accent: '#A7F3D0', badge: 'ANGGOTA GURU' },
    staff: { from: '#4C1D95', to: '#8B5CF6', accent: '#DDD6FE', badge: 'ANGGOTA STAF' },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, y);
            line = word;
            y += lineHeight;
        } else { line = test; }
    }
    ctx.fillText(line, x, y);
    return y;
}

function drawCard(canvas: HTMLCanvasElement, member: Member, school: School, logoImg: HTMLImageElement | null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;
    const theme = THEMES[member.type] || THEMES.siswa;

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Rounded card clip
    const r = 18;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
    ctx.quadraticCurveTo(W, 0, W, r);
    ctx.lineTo(W, H - r);
    ctx.quadraticCurveTo(W, H, W - r, H);
    ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();

    // ── Header gradient bar ─────────────────────────────────────────────────
    const headerH = 120;
    const grad = ctx.createLinearGradient(0, 0, W, headerH);
    grad.addColorStop(0, theme.from);
    grad.addColorStop(1, theme.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, headerH);

    // Decorative circles in header
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W - 50, -30, 90, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 120, 60, 50, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // ── Logo in header (if any) ─────────────────────────────────────────────
    if (logoImg) {
        const logoSize = 56;
        ctx.save();
        ctx.beginPath();
        ctx.arc(32 + logoSize / 2, headerH / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, 32, (headerH - logoSize) / 2, logoSize, logoSize);
        ctx.restore();
    }

    // ── School name in header ───────────────────────────────────────────────
    const textX = logoImg ? 100 : 28;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 17px Inter, Arial, sans-serif';
    const schoolName = school.school_name || 'Perpustakaan Sekolah';
    ctx.fillText(schoolName.length > 34 ? schoolName.slice(0, 33) + '…' : schoolName, textX, headerH / 2 - 10);

    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText('KARTU ANGGOTA PERPUSTAKAAN', textX, headerH / 2 + 12);
    ctx.globalAlpha = 1;

    // ── Photo circle ────────────────────────────────────────────────────────
    const photoX = 50, photoY = headerH + 20;
    const photoR = 50;
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    // Photo background
    const photoGrad = ctx.createRadialGradient(photoX, photoY + photoR, 0, photoX, photoY + photoR, photoR);
    photoGrad.addColorStop(0, theme.to);
    photoGrad.addColorStop(1, theme.from);
    ctx.fillStyle = photoGrad;
    ctx.beginPath();
    ctx.arc(photoX, photoY + photoR, photoR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Initials
    const initials = member.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${photoR * 0.72}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, photoX, photoY + photoR);

    // White ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(photoX, photoY + photoR, photoR + 3, 0, Math.PI * 2);
    ctx.stroke();

    // ── Member info ─────────────────────────────────────────────────────────
    const infoX = photoX + photoR + 30;
    const infoY = headerH + 22;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Name
    ctx.fillStyle = '#111827';
    ctx.font = `bold 20px Inter, Arial, sans-serif`;
    const finalY = wrapText(ctx, member.name, infoX, infoY, W - infoX - 24, 25);

    // ID badge
    const badgeY = finalY + 30;
    ctx.fillStyle = theme.from + '18';
    const idText = member.member_id;
    ctx.font = 'bold 12px "Courier New", monospace';
    const idW = ctx.measureText(idText).width + 24;
    roundRect(ctx, infoX, badgeY, idW, 24, 6, theme.from + '22', theme.from);
    ctx.fillStyle = theme.from;
    ctx.textBaseline = 'middle';
    ctx.fillText(idText, infoX + 12, badgeY + 12);

    // Class / major / role
    const detailY = badgeY + 36;
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.textBaseline = 'top';
    const typeLabel = member.type === 'siswa' ? 'Siswa' : member.type === 'guru' ? 'Guru' : 'Staf';
    if (member.class) {
        ctx.fillText(`Kelas  :  ${member.class}`, infoX, detailY);
        ctx.fillText(typeLabel, infoX, detailY + 18);
    } else {
        ctx.fillText(typeLabel, infoX, detailY);
    }

    // ── Divider ─────────────────────────────────────────────────────────────
    const divY = H - 70;
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(24, divY); ctx.lineTo(W - 24, divY); ctx.stroke();

    // ── Footer bar ──────────────────────────────────────────────────────────
    const footerGrad = ctx.createLinearGradient(0, divY, W, H);
    footerGrad.addColorStop(0, theme.from + '08');
    footerGrad.addColorStop(1, theme.to + '14');
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, divY, W, H - divY);

    // Type badge (pill)
    const badgeText = theme.badge;
    ctx.font = 'bold 10.5px Inter, Arial, sans-serif';
    const badgePillW = ctx.measureText(badgeText).width + 28;
    const badgePillX = 24, badgePillY = divY + 12;
    const pillGrad = ctx.createLinearGradient(badgePillX, 0, badgePillX + badgePillW, 0);
    pillGrad.addColorStop(0, theme.from);
    pillGrad.addColorStop(1, theme.to);
    roundRect(ctx, badgePillX, badgePillY, badgePillW, 22, 11, pillGrad, 'transparent');
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgePillX + 14, badgePillY + 11);

    // Status
    ctx.font = '10px Inter, Arial, sans-serif';
    const statusColor = member.status === 'aktif' ? '#16A34A' : '#DC2626';
    ctx.fillStyle = statusColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(`● ${member.status === 'aktif' ? 'AKTIF' : 'NON-AKTIF'}`, W - 24, badgePillY + 11);

    // Joined date
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '9.5px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    const joinedDate = new Date(member.joined_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    ctx.fillText(`Bergabung: ${joinedDate}`, W - 24, badgePillY + 28);

    ctx.textAlign = 'left';
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
    fill: string | CanvasGradient,
    stroke: string | CanvasGradient,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (typeof fill !== 'string' || fill !== 'transparent') { ctx.fillStyle = fill; ctx.fill(); }
    if (typeof stroke !== 'string' || stroke !== 'transparent') { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

export function IdCardModal({ member, school, onClose }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (school.school_logo && school.school_logo.startsWith('data:image')) {
            const img = new Image();
            img.onload = () => {
                if (canvasRef.current) { drawCard(canvasRef.current, member, school, img); }
                setReady(true);
            };
            img.onerror = () => {
                if (canvasRef.current) { drawCard(canvasRef.current, member, school, null); }
                setReady(true);
            };
            img.src = school.school_logo;
        } else {
            drawCard(canvasRef.current, member, school, null);
            setReady(true);
        }
    }, [member, school]);

    const download = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `id-card-${member.member_id}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    const theme = THEMES[member.type] || THEMES.siswa;

    return (
        <div
            className="modal-overlay"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{ zIndex: 9999 }}
        >
            <div className="modal" style={{ maxWidth: 700, padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                    background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                    padding: '18px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CreditCard size={20} color="#fff" />
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Preview Kartu Anggota</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Card preview */}
                <div style={{ padding: '28px 32px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                    <div style={{
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)',
                        lineHeight: 0,
                        opacity: ready ? 1 : 0,
                        transition: 'opacity 0.3s',
                    }}>
                        <canvas
                            ref={canvasRef}
                            style={{ display: 'block', width: Math.round(W / 1.5), height: Math.round(H / 1.5) }}
                        />
                    </div>

                    {/* Info summary */}
                    <div style={{
                        display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)',
                        background: 'var(--bg-primary)', borderRadius: 10, padding: '10px 20px',
                        border: '1px solid var(--border-color)', width: '100%', justifyContent: 'center',
                    }}>
                        <span><strong style={{ color: 'var(--text-primary)' }}>Nama:</strong> {member.name}</span>
                        <span>·</span>
                        <span><strong style={{ color: 'var(--text-primary)' }}>ID:</strong> {member.member_id}</span>
                        {member.class && <><span>·</span><span><strong style={{ color: 'var(--text-primary)' }}>Kelas:</strong> {member.class}</span></>}
                    </div>

                    {/* Download button */}
                    <button
                        onClick={download}
                        disabled={!ready}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            boxShadow: `0 4px 14px ${theme.from}55`,
                            transition: 'opacity 0.15s',
                            opacity: ready ? 1 : 0.5,
                        }}
                    >
                        <Download size={16} />
                        Download ID Card (PNG)
                    </button>

                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                        File PNG resolusi tinggi siap print ukuran kartu (85.6 × 54 mm)
                    </p>
                </div>
            </div>
        </div>
    );
}
