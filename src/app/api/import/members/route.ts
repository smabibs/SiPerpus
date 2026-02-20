import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb, logAudit } from '@/lib/db';

// ── GET: Download template Excel ────────────────────────────────────────────
export async function GET() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SiPERPUS';

    const ws = wb.addWorksheet('Data Anggota');
    const ACCENT = '1E3A8A';
    const COLS = [
        { header: 'ID Anggota *', key: 'member_id', width: 18, },
        { header: 'Nama Lengkap *', key: 'name', width: 32, },
        { header: 'Tipe *', key: 'type', width: 14, },
        { header: 'Kelas', key: 'class', width: 16, },
        { header: 'Jurusan', key: 'major', width: 14, },
        { header: 'Telepon', key: 'phone', width: 18, },
        { header: 'Email', key: 'email', width: 28, },
        { header: 'Alamat', key: 'address', width: 36, },
    ];

    ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    const headerRow = ws.addRow(COLS.map(c => c.header));
    headerRow.height = 28;
    headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: 'H1' };

    // Sample rows
    const samples = [
        ['SIS2024001', 'Andi Pratama', 'siswa', 'X-IPA-1', 'IPA', '081234567890', 'andi@email.com', 'Jl. Merdeka No. 1'],
        ['SIS2024002', 'Budi Santoso', 'siswa', 'XI-IPS-2', 'IPS', '', '', ''],
        ['GUR001', 'Ibu Sri Wahyuni, S.Pd', 'guru', '', '', '081987654321', 'sri@sekolah.id', ''],
    ];
    samples.forEach((row, i) => {
        const r = ws.addRow(row);
        r.height = 20;
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF0F4FF' : 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle' };
            cell.font = { size: 10.5, color: { argb: 'FF1F2937' } };
        });
    });

    // Instructions sheet
    const wsInfo = wb.addWorksheet('📋 Petunjuk');
    wsInfo.getColumn('A').width = 28;
    wsInfo.getColumn('B').width = 60;

    const addInfoRow = (label: string, value: string, bold = false) => {
        const r = wsInfo.addRow([label, value]);
        r.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${ACCENT}` } };
        r.getCell(2).font = { bold, size: 11 };
        r.height = 20;
    };

    wsInfo.addRow([]);
    addInfoRow('SiPERPUS — Template Import Anggota', '', true);
    wsInfo.addRow([]);
    addInfoRow('KOLOM WAJIB', 'ID Anggota, Nama Lengkap, Tipe', true);
    addInfoRow('KOLOM OPSIONAL', 'Kelas, Jurusan, Telepon, Email, Alamat');
    wsInfo.addRow([]);
    addInfoRow('Tipe Anggota', 'siswa / guru / staff (huruf kecil)');
    addInfoRow('ID Anggota', 'Harus unik, contoh: SIS2024001, GUR001');
    wsInfo.addRow([]);
    addInfoRow('TIPS', 'Hapus baris contoh (baris 2-4) sebelum mengisi data Anda');
    addInfoRow('', 'Baris kosong akan diabaikan otomatis');
    addInfoRow('', 'Jika ID Anggota sudah ada, baris akan dilewati');

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="template-import-anggota.xlsx"',
        },
    });
}

// ── POST: Parse & insert members from uploaded Excel ────────────────────────
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 });

        const buffer = new Uint8Array(await file.arrayBuffer()).buffer;
        const wb = new ExcelJS.Workbook();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (wb.xlsx as any).load(buffer);

        const ws = wb.worksheets[0];
        if (!ws) return NextResponse.json({ error: 'File tidak valid atau sheet kosong' }, { status: 400 });

        const db = getDb();
        const results = { imported: 0, skipped: 0, errors: [] as string[] };
        const validTypes = ['siswa', 'guru', 'staff'];

        const insertStmt = db.prepare(`
            INSERT INTO members (member_id, name, type, class, major, phone, email, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let rowNum = 0;
        ws.eachRow((row, idx) => {
            if (idx === 1) return; // skip header
            rowNum++;

            const vals = (row.values as ExcelJS.CellValue[]).slice(1);
            const memberId = String(vals[0] ?? '').trim();
            const name = String(vals[1] ?? '').trim();
            const type = String(vals[2] ?? '').trim().toLowerCase();
            const cls = String(vals[3] ?? '').trim() || null;
            const major = String(vals[4] ?? '').trim() || null;
            const phone = String(vals[5] ?? '').trim() || null;
            const email = String(vals[6] ?? '').trim() || null;
            const address = String(vals[7] ?? '').trim() || null;

            if (!memberId || !name) return; // skip empty rows

            if (!validTypes.includes(type)) {
                results.errors.push(`Baris ${idx}: Tipe "${type}" tidak valid (harus siswa/guru/staff)`);
                results.skipped++;
                return;
            }

            // Check duplicate member_id
            const exists = db.prepare('SELECT id FROM members WHERE member_id = ?').get(memberId);
            if (exists) {
                results.skipped++;
                results.errors.push(`Baris ${idx}: ID "${memberId}" sudah ada, dilewati`);
                return;
            }

            try {
                const result = insertStmt.run(memberId, name, type, cls, major, phone, email, address);
                logAudit('CREATE', 'member', result.lastInsertRowid, name, `Import Excel — ID: ${memberId}`);
                results.imported++;
            } catch (e) {
                results.errors.push(`Baris ${idx} ("${name}"): ${String(e)}`);
            }
        });

        if (rowNum === 0) return NextResponse.json({ error: 'File tidak berisi data anggota' }, { status: 400 });

        return NextResponse.json(results);
    } catch (e) {
        return NextResponse.json({ error: `Gagal membaca file: ${String(e)}` }, { status: 500 });
    }
}
