import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const db = getDb();
        const tags = db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
        return NextResponse.json({ tags });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const { name, color } = await req.json();
        if (!name) return NextResponse.json({ error: 'Nama tag wajib diisi' }, { status: 400 });

        const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name.trim(), color || '#6366F1');
        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(tag, { status: 201 });
    } catch (e) {
        if (String(e).includes('UNIQUE')) {
            return NextResponse.json({ error: 'Tag sudah ada' }, { status: 400 });
        }
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const { id, name, color } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID wajib' }, { status: 400 });

        db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name?.trim(), color || '#6366F1', id);
        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        return NextResponse.json(tag);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID wajib' }, { status: 400 });

        db.prepare('DELETE FROM book_tags WHERE tag_id = ?').run(id);
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
