import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'library.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDb(db);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function reopenDb() {
  closeDb();
  return getDb();
}

export function logAudit(
  action: string,
  entityType: string,
  entityId: string | number | bigint,
  entityName: string,
  details?: string
) {
  try {
    const d = getDb();
    d.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(action, entityType, String(entityId), entityName, details || null);
  } catch {
    // Don't let audit logging break the main operation
  }
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#4F46E5',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT UNIQUE,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      year INTEGER,
      edition TEXT,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      total_copies INTEGER DEFAULT 1,
      available_copies INTEGER DEFAULT 1,
      shelf_location TEXT,
      description TEXT,
      language TEXT DEFAULT 'Indonesia',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('siswa','guru','staff')),
      class TEXT,
      major TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif','nonaktif')),
      joined_at TEXT DEFAULT (datetime('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      quantity INTEGER DEFAULT 1,
      loan_date TEXT DEFAULT (datetime('now','localtime')),
      due_date TEXT NOT NULL,
      return_date TEXT,
      status TEXT DEFAULT 'dipinjam' CHECK(status IN ('dipinjam','dikembalikan','terlambat')),
      fine INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
    CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject_id);
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
    CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
  `);

  // Migration: add quantity column if not exists (for existing DBs)
  try {
    db.exec(`ALTER TABLE loans ADD COLUMN quantity INTEGER DEFAULT 1`);
  } catch {
    // Column already exists, ignore
  }

  // Migration: add settings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migration: add audit_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
  `);

  // Migration: add photo column to members
  try {
    db.exec(`ALTER TABLE members ADD COLUMN photo TEXT`);
  } catch {
    // Column already exists
  }

  // Migration: reservations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      reserved_at TEXT DEFAULT (datetime('now','localtime')),
      expires_at TEXT,
      status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif','terpenuhi','dibatalkan')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations(book_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_member ON reservations(member_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
  `);

  // Migration: tags + book_tags tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366F1',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS book_tags (
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (book_id, tag_id)
    );
  `);

  // Seed default data if empty
  const subjectCount = db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number };
  if (subjectCount.c === 0) {
    seedDefaultData(db);
  }
}

function seedDefaultData(db: Database.Database) {
  // Insert default subjects (SMA mata pelajaran)
  const subjects = [
    { name: 'Matematika', color: '#EF4444', description: 'Pelajaran Matematika SMA' },
    { name: 'Fisika', color: '#F97316', description: 'Pelajaran Fisika SMA' },
    { name: 'Kimia', color: '#EAB308', description: 'Pelajaran Kimia SMA' },
    { name: 'Biologi', color: '#22C55E', description: 'Pelajaran Biologi SMA' },
    { name: 'Bahasa Indonesia', color: '#3B82F6', description: 'Pelajaran Bahasa Indonesia SMA' },
    { name: 'Bahasa Inggris', color: '#6366F1', description: 'Pelajaran Bahasa Inggris SMA' },
    { name: 'Sejarah', color: '#8B5CF6', description: 'Pelajaran Sejarah SMA' },
    { name: 'Geografi', color: '#EC4899', description: 'Pelajaran Geografi SMA' },
    { name: 'Ekonomi', color: '#14B8A6', description: 'Pelajaran Ekonomi SMA' },
    { name: 'Sosiologi', color: '#F59E0B', description: 'Pelajaran Sosiologi SMA' },
    { name: 'Pendidikan Agama', color: '#10B981', description: 'Pelajaran Pendidikan Agama SMA' },
    { name: 'PPKn', color: '#6366F1', description: 'Pendidikan Pancasila dan Kewarganegaraan' },
    { name: 'Seni Budaya', color: '#F43F5E', description: 'Pelajaran Seni Budaya SMA' },
    { name: 'Penjaskes', color: '#84CC16', description: 'Pendidikan Jasmani dan Kesehatan' },
    { name: 'TIK / Informatika', color: '#06B6D4', description: 'Teknologi Informasi dan Komunikasi' },
    { name: 'Sastra Indonesia', color: '#A78BFA', description: 'Sastra Indonesia' },
    { name: 'Umum / Fiksi', color: '#94A3B8', description: 'Buku umum, fiksi, dan pengembangan diri' },
  ];

  const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (name, color, description) VALUES (?, ?, ?)');
  for (const s of subjects) {
    insertSubject.run(s.name, s.color, s.description);
  }

  // Insert default categories
  const categories = [
    { name: 'Buku Teks', description: 'Buku pelajaran utama' },
    { name: 'Buku Referensi', description: 'Kamus, ensiklopedia, atlas' },
    { name: 'Fiksi', description: 'Novel, cerpen, puisi' },
    { name: 'Non-Fiksi', description: 'Biografi, sejarah, sains populer' },
    { name: 'Majalah / Jurnal', description: 'Majalah dan jurnal ilmiah' },
    { name: 'Pengembangan Diri', description: 'Motivasi dan pengembangan diri' },
  ];

  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
  for (const c of categories) {
    insertCat.run(c.name, c.description);
  }

  // Insert sample books
  const sampleBooks = [
    { isbn: '9786021862339', title: 'Matematika SMA Kelas X', author: 'Sukino', publisher: 'Erlangga', year: 2022, subject: 'Matematika', category: 'Buku Teks', copies: 10, shelf: 'A-01' },
    { isbn: '9786021862346', title: 'Matematika SMA Kelas XI', author: 'Sukino', publisher: 'Erlangga', year: 2022, subject: 'Matematika', category: 'Buku Teks', copies: 10, shelf: 'A-02' },
    { isbn: '9786021862353', title: 'Matematika SMA Kelas XII', author: 'Sukino', publisher: 'Erlangga', year: 2022, subject: 'Matematika', category: 'Buku Teks', copies: 8, shelf: 'A-03' },
    { isbn: '9786021862360', title: 'Fisika untuk SMA Kelas X', author: 'Marthen Kanginan', publisher: 'Erlangga', year: 2022, subject: 'Fisika', category: 'Buku Teks', copies: 10, shelf: 'B-01' },
    { isbn: '9786021862377', title: 'Fisika untuk SMA Kelas XI', author: 'Marthen Kanginan', publisher: 'Erlangga', year: 2022, subject: 'Fisika', category: 'Buku Teks', copies: 10, shelf: 'B-02' },
    { isbn: '9786021862384', title: 'Kimia SMA Kelas X', author: 'Michael Purba', publisher: 'Erlangga', year: 2022, subject: 'Kimia', category: 'Buku Teks', copies: 10, shelf: 'C-01' },
    { isbn: '9786021862391', title: 'Kimia SMA Kelas XI', author: 'Michael Purba', publisher: 'Erlangga', year: 2022, subject: 'Kimia', category: 'Buku Teks', copies: 10, shelf: 'C-02' },
    { isbn: '9786021862407', title: 'Biologi SMA Kelas X', author: 'Istamar Syamsuri', publisher: 'Erlangga', year: 2022, subject: 'Biologi', category: 'Buku Teks', copies: 10, shelf: 'D-01' },
    { isbn: '9786021862414', title: 'Biologi SMA Kelas XI', author: 'Istamar Syamsuri', publisher: 'Erlangga', year: 2022, subject: 'Biologi', category: 'Buku Teks', copies: 10, shelf: 'D-02' },
    { isbn: '9786021862421', title: 'Bahasa Indonesia Ekspresi Diri Kelas X', author: 'Kemendikbud', publisher: 'Kemendikbud', year: 2023, subject: 'Bahasa Indonesia', category: 'Buku Teks', copies: 15, shelf: 'E-01' },
    { isbn: '9786021862438', title: 'Bahasa Inggris Kelas X', author: 'Th. M. Sudarwati', publisher: 'Erlangga', year: 2022, subject: 'Bahasa Inggris', category: 'Buku Teks', copies: 12, shelf: 'F-01' },
    { isbn: '9786021862445', title: 'Sejarah Indonesia Kelas X', author: 'Kemendikbud', publisher: 'Kemendikbud', year: 2023, subject: 'Sejarah', category: 'Buku Teks', copies: 10, shelf: 'G-01' },
    { isbn: '9786021862452', title: 'Geografi SMA Kelas X', author: 'Eko Bambang Subiyantoro', publisher: 'Erlangga', year: 2022, subject: 'Geografi', category: 'Buku Teks', copies: 10, shelf: 'H-01' },
    { isbn: '9786021862469', title: 'Ekonomi SMA Kelas X', author: 'Alam S.', publisher: 'Esis', year: 2022, subject: 'Ekonomi', category: 'Buku Teks', copies: 10, shelf: 'I-01' },
    { isbn: '9786021862476', title: 'Sosiologi SMA Kelas X', author: 'Kun Maryati', publisher: 'Esis', year: 2022, subject: 'Sosiologi', category: 'Buku Teks', copies: 10, shelf: 'J-01' },
    { isbn: '9789795550212', title: 'Laskar Pelangi', author: 'Andrea Hirata', publisher: 'Bentang Pustaka', year: 2008, subject: 'Umum / Fiksi', category: 'Fiksi', copies: 5, shelf: 'Z-01' },
    { isbn: '9789792238044', title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer', publisher: 'Lentera Dipantara', year: 2011, subject: 'Sastra Indonesia', category: 'Fiksi', copies: 3, shelf: 'Z-02' },
    { isbn: '9789799753854', title: 'Negeri 5 Menara', author: 'Ahmad Fuadi', publisher: 'PT Gramedia Pustaka Utama', year: 2009, subject: 'Umum / Fiksi', category: 'Fiksi', copies: 4, shelf: 'Z-03' },
    { isbn: '9786020633459', title: 'Atomic Habits', author: 'James Clear', publisher: 'Gramedia', year: 2020, subject: 'Umum / Fiksi', category: 'Pengembangan Diri', copies: 3, shelf: 'Z-04' },
    { isbn: '9786021862483', title: 'Informatika SMA Kelas X', author: 'Kemendikbud', publisher: 'Kemendikbud', year: 2023, subject: 'TIK / Informatika', category: 'Buku Teks', copies: 10, shelf: 'K-01' },
  ];

  const getSubjectId = db.prepare('SELECT id FROM subjects WHERE name = ?');
  const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertBook = db.prepare(`
    INSERT OR IGNORE INTO books (isbn, title, author, publisher, year, subject_id, category_id, total_copies, available_copies, shelf_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of sampleBooks) {
    const sub = getSubjectId.get(b.subject) as { id: number } | undefined;
    const cat = getCategoryId.get(b.category) as { id: number } | undefined;
    insertBook.run(b.isbn, b.title, b.author, b.publisher, b.year, sub?.id ?? null, cat?.id ?? null, b.copies, b.copies, b.shelf);
  }

  // Insert sample members (siswa)
  const classes = ['X-IPA-1', 'X-IPA-2', 'X-IPS-1', 'X-IPS-2', 'XI-IPA-1', 'XI-IPA-2', 'XI-IPS-1', 'XI-IPS-2', 'XII-IPA-1', 'XII-IPA-2', 'XII-IPS-1', 'XII-IPS-2'];
  const firstNames = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gita', 'Hani', 'Ivan', 'Juli', 'Kiki', 'Luna', 'Mira', 'Nana', 'Oka', 'Putri', 'Rudi', 'Sari', 'Tono', 'Umar'];
  const lastNames = ['Pratama', 'Sari', 'Wijaya', 'Santoso', 'Rahayu', 'Susanto', 'Wati', 'Kurniawan', 'Permata', 'Handoko'];

  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO members (member_id, name, type, class, major, status)
    VALUES (?, ?, 'siswa', ?, ?, 'aktif')
  `);

  let counter = 1;
  for (const cls of classes) {
    const major = cls.includes('IPA') ? 'IPA' : 'IPS';
    for (let i = 0; i < 5; i++) {
      const name = `${firstNames[(counter * 3) % firstNames.length]} ${lastNames[(counter * 7) % lastNames.length]}`;
      const memberId = `SIS${String(2024000 + counter).padStart(7, '0')}`;
      insertMember.run(memberId, name, cls, major);
      counter++;
    }
  }

  // Insert sample teachers
  const teachers = [
    { id: 'GUR001', name: 'Bapak Ahmad Fauzi, S.Pd', subject: 'Matematika' },
    { id: 'GUR002', name: 'Ibu Sri Wahyuni, S.Pd', subject: 'Bahasa Indonesia' },
    { id: 'GUR003', name: 'Bapak Hendra Saputra, S.T', subject: 'Fisika' },
    { id: 'GUR004', name: 'Ibu Dewi Lestari, S.Si', subject: 'Kimia' },
    { id: 'GUR005', name: 'Bapak Eko Prasetyo, S.Pd', subject: 'Sejarah' },
  ];

  const insertTeacher = db.prepare(`
    INSERT OR IGNORE INTO members (member_id, name, type, status)
    VALUES (?, ?, 'guru', 'aktif')
  `);
  for (const t of teachers) {
    insertTeacher.run(t.id, t.name);
  }

  // Insert sample loans
  const allBooks = db.prepare('SELECT id FROM books LIMIT 10').all() as { id: number }[];
  const allMembers = db.prepare('SELECT id FROM members LIMIT 20').all() as { id: number }[];

  const insertLoan = db.prepare(`
    INSERT INTO loans (book_id, member_id, loan_date, due_date, status)
    VALUES (?, ?, datetime('now','localtime','-' || ? || ' days'), datetime('now','localtime','-' || ? || ' days', '+14 days'), ?)
  `);

  const updateBookCopies = db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?');

  const loanData = [
    { bookIdx: 0, memberIdx: 0, daysAgo: 3, status: 'dipinjam' },
    { bookIdx: 1, memberIdx: 1, daysAgo: 5, status: 'dipinjam' },
    { bookIdx: 2, memberIdx: 2, daysAgo: 20, status: 'terlambat' },
    { bookIdx: 3, memberIdx: 3, daysAgo: 1, status: 'dipinjam' },
    { bookIdx: 4, memberIdx: 4, daysAgo: 8, status: 'dipinjam' },
    { bookIdx: 5, memberIdx: 5, daysAgo: 25, status: 'terlambat' },
  ];

  for (const l of loanData) {
    if (allBooks[l.bookIdx] && allMembers[l.memberIdx]) {
      insertLoan.run(allBooks[l.bookIdx].id, allMembers[l.memberIdx].id, l.daysAgo, l.daysAgo, l.status);
      if (l.status !== 'dikembalikan') {
        updateBookCopies.run(allBooks[l.bookIdx].id);
      }
    }
  }
}
