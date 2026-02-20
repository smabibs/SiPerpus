import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const db = getDb();
        const categories = db.prepare(`
            SELECT c.*, COUNT(b.id) as book_count
            FROM categories c
            LEFT JOIN books b ON b.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        `).all();
        return NextResponse.json({ categories });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { name, description } = body;
        if (!name) return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });

        const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
        const newCat = db.prepare('SELECT *, 0 as book_count FROM categories WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(newCat, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { id, name, description } = body;
        if (!id || !name) return NextResponse.json({ error: 'ID dan nama wajib diisi' }, { status: 400 });

        db.prepare('UPDATE categories SET name=?, description=? WHERE id=?').run(name, description || null, id);
        const updated = db.prepare(`SELECT c.*, COUNT(b.id) as book_count FROM categories c LEFT JOIN books b ON b.category_id = c.id WHERE c.id=? GROUP BY c.id`).get(id);
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

        const bookCount = db.prepare('SELECT COUNT(*) as c FROM books WHERE category_id = ?').get(id) as { c: number };
        if (bookCount.c > 0) return NextResponse.json({ error: `Kategori masih digunakan oleh ${bookCount.c} buku` }, { status: 400 });

        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
