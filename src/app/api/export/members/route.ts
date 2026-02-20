import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';
import { getSchoolSettings, addSchoolHeader, addSignatureFooter } from '@/lib/excelHelper';

const ACCENT = '065F46';
const ACCENT_LIGHT = 'FFECFDF5';
const TOTAL_COLS = 10;

export async function GET() {
    try {
        const db = getDb();
        const school = getSchoolSettings(db);

        const members = db.prepare(`
            SELECT member_id, name, type, class, major, phone, email, address, status, joined_at
            FROM members
            ORDER BY type, class, name
        `).all() as Record<string, string>[];

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SiPERPUS';
        wb.created = new Date();

        const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const siswa = members.filter(m => m.type === 'siswa').length;
        const guru = members.filter(m => m.type === 'guru').length;
        const staff = members.filter(m => m.type === 'staff').length;

        const ws = wb.addWorksheet('Data Anggota', {
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
            headerFooter: {
                oddHeader: `&C&"Arial,Bold"${school.school_name} — DATA ANGGOTA`,
                oddFooter: `&L${school.school_address}, ${school.school_city}&RHalaman &P dari &N`,
            },
        });

        ws.columns = [
            { key: 'no', width: 5 }, { key: 'member_id', width: 14 }, { key: 'name', width: 28 },
            { key: 'type', width: 10 }, { key: 'class', width: 14 }, { key: 'major', width: 12 },
            { key: 'phone', width: 16 }, { key: 'email', width: 24 }, { key: 'status', width: 10 }, { key: 'joined', width: 14 },
        ];

        // School identity header
        const headerEndRow = await addSchoolHeader(
            ws, school, TOTAL_COLS, ACCENT,
            'Data Anggota Perpustakaan',
            `Dicetak: ${now}  ·  Total: ${members.length} anggota (${siswa} siswa, ${guru} guru, ${staff} staf)`
        );

        // Column header
        const headerRow = ws.addRow([
            'No', 'ID Anggota', 'Nama Lengkap', 'Tipe', 'Kelas', 'Jurusan', 'No. HP', 'Email', 'Status', 'Tgl Bergabung'
        ]);
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        headerRow.height = 30;

        const dataStartRow = headerEndRow + 1;
        ws.autoFilter = { from: { row: dataStartRow, column: 1 }, to: { row: dataStartRow, column: TOTAL_COLS } };
        ws.views = [{ state: 'frozen', xSplit: 0, ySplit: dataStartRow, activeCell: `A${dataStartRow + 1}` }];

        const typeColors: Record<string, string> = { siswa: 'FF3B82F6', guru: 'FF22C55E', staff: 'FFF59E0B' };

        members.forEach((m, i) => {
            const joinDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString('id-ID') : '';
            const row = ws.addRow([
                i + 1, m.member_id, m.name, m.type, m.class || '-', m.major || '-',
                m.phone || '', m.email || '', m.status, joinDate
            ]);
            const isEven = (i + 1) % 2 === 0;
            row.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? ACCENT_LIGHT : 'FFFFFFFF' } };
                cell.border = { top: { style: 'hair', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } }, left: { style: 'hair', color: { argb: 'FFCCCCCC' } }, right: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
                if (col === 1) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.font = { color: { argb: 'FF888888' }, size: 9.5 }; }
                else if (col === 4) {
                    cell.font = { bold: true, color: { argb: typeColors[m.type] || 'FF333333' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (col === 9) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    if (m.status === 'aktif') cell.font = { color: { argb: 'FF16A34A' }, bold: true };
                    else cell.font = { color: { argb: 'FFDC2626' } };
                } else { cell.alignment = { vertical: 'middle' }; }
            });
            row.height = 19;
        });

        // Summary row
        const summaryRow = ws.addRow([
            '', '', `${members.length} anggota  ·  ${siswa} siswa  ·  ${guru} guru  ·  ${staff} staf`,
            '', '', '', '', '', '', ''
        ]);
        summaryRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        summaryRow.height = 22;

        addSignatureFooter(ws, school, TOTAL_COLS, ACCENT);

        const buf = await wb.xlsx.writeBuffer();
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="data-anggota-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
