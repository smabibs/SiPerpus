import { NextRequest, NextResponse } from 'next/server';
import { getDb, closeDb, reopenDb, logAudit } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'library.db');

// GET: Download backup of the database
export async function GET() {
    try {
        const db = getDb();
        // Force WAL checkpoint to ensure all data is in the main file
        db.pragma('wal_checkpoint(FULL)');

        const fileBuffer = fs.readFileSync(DB_PATH);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `backup_siperpus_${timestamp}.db`;

        logAudit('BACKUP', 'system', 0, 'Database Backup', `File: ${filename}, Size: ${(fileBuffer.length / 1024).toFixed(0)} KB`);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// POST: Restore database from uploaded file
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
        }

        if (!file.name.endsWith('.db')) {
            return NextResponse.json({ error: 'File harus berformat .db' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate it's a valid SQLite file (magic bytes: "SQLite format 3\0")
        const magic = buffer.toString('utf8', 0, 15);
        if (magic !== 'SQLite format 3') {
            return NextResponse.json({ error: 'File bukan database SQLite yang valid' }, { status: 400 });
        }

        // Create backup of current DB before restoring
        const backupPath = DB_PATH + '.bak';
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, backupPath);
        }

        // Close current connection
        closeDb();

        // Remove WAL and SHM files if they exist
        const walPath = DB_PATH + '-wal';
        const shmPath = DB_PATH + '-shm';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

        // Write new database
        fs.writeFileSync(DB_PATH, buffer);

        // Reopen connection (this will also run migrations)
        reopenDb();

        logAudit('RESTORE', 'system', 0, 'Database Restore', `File: ${file.name}, Size: ${(buffer.length / 1024).toFixed(0)} KB`);

        return NextResponse.json({ success: true, message: 'Database berhasil di-restore' });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
