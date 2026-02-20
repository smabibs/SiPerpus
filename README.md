# SiPERPUS - Sistem Informasi Perpustakaan

A modern library management system built with Next.js, TypeScript, and SQLite.

## Features

- 📚 Book management with ISBN lookup
- 👥 Member management with Excel import
- 📖 Loan tracking and returns
- 📅 Book reservations
- 🏷️ Tags and categories
- 📊 Reports and statistics
- 🔍 Barcode scanning and generation
- 📝 Audit logs
- ⚙️ Configurable settings

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/smabibs/SiPerpus.git
   cd SiPerpus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file (optional):
   ```env
   SESSION_SECRET=your-secret-key
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=your-password
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (via better-sqlite3)
- **Styling**: CSS
