import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'members');

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const memberId = formData.get('member_id') as string | null;

        if (!file || !memberId) {
            return NextResponse.json({ error: 'File dan member_id wajib diisi' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Hanya file JPG, PNG, atau WebP yang diperbolehkan' }, { status: 400 });
        }

        // Max 2MB
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 });
        }

        // Ensure upload directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const filename = `member_${memberId}_${Date.now()}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filepath, buffer);

        // Update database
        const db = getDb();
        // Delete old photo file if exists
        const existing = db.prepare('SELECT photo FROM members WHERE id = ?').get(memberId) as { photo: string | null } | undefined;
        if (existing?.photo) {
            const oldPath = path.join(UPLOAD_DIR, existing.photo);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        db.prepare('UPDATE members SET photo = ? WHERE id = ?').run(filename, memberId);

        return NextResponse.json({ photo: filename, url: `/uploads/members/${filename}` });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// DELETE: Remove member photo
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('member_id');
        if (!memberId) return NextResponse.json({ error: 'member_id wajib' }, { status: 400 });

        const db = getDb();
        const existing = db.prepare('SELECT photo FROM members WHERE id = ?').get(memberId) as { photo: string | null } | undefined;
        if (existing?.photo) {
            const oldPath = path.join(UPLOAD_DIR, existing.photo);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        db.prepare('UPDATE members SET photo = NULL WHERE id = ?').run(memberId);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
