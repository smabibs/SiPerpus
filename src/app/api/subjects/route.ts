import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const db = getDb();
        const subjects = db.prepare(`
      SELECT s.*, COUNT(b.id) as book_count
      FROM subjects s
      LEFT JOIN books b ON b.subject_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all();
        return NextResponse.json({ subjects });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { name, description, color } = body;
        if (!name) return NextResponse.json({ error: 'Nama mata pelajaran wajib diisi' }, { status: 400 });

        const result = db.prepare('INSERT INTO subjects (name, description, color) VALUES (?, ?, ?)').run(name, description || null, color || '#4F46E5');
        const newSubject = db.prepare('SELECT *, 0 as book_count FROM subjects WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(newSubject, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { id, name, description, color } = body;
        if (!id || !name) return NextResponse.json({ error: 'ID dan nama wajib diisi' }, { status: 400 });

        db.prepare('UPDATE subjects SET name=?, description=?, color=? WHERE id=?').run(name, description || null, color || '#4F46E5', id);
        const updated = db.prepare(`SELECT s.*, COUNT(b.id) as book_count FROM subjects s LEFT JOIN books b ON b.subject_id = s.id WHERE s.id=? GROUP BY s.id`).get(id);
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

        const bookCount = db.prepare('SELECT COUNT(*) as c FROM books WHERE subject_id = ?').get(id) as { c: number };
        if (bookCount.c > 0) return NextResponse.json({ error: `Mata pelajaran masih digunakan oleh ${bookCount.c} buku` }, { status: 400 });

        db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
