# AssetFlow Enterprise — Asset Management System

A production-ready **Next.js App Router + TypeScript + direct MySQL** web application for comprehensive enterprise IT asset lifecycle management.

---

## 🚀 Core Lifecycle Workflow

```
Purchase/Register Asset
  → Generate Unique Permanent Asset Number (e.g. AST-LAP-00001)
  → Generate Code 128 Barcode
  → Print Barcode Sticker (with @media print thermal support)
  → Assign Asset to Employee
  → Scan Barcode using Phone Camera or Webcam
  → Fetch Asset from MySQL
  → Show authorized Asset Details
  → Raise Ticket (e.g. TKT-2026-00001)
  → Track Ticket Status/History (ticket_history)
  → Transfer / Return / Reassign Asset (asset_assignments)
  → Maintain Complete Asset History (asset_history)
  → Reports & CSV Export
```

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict typing, no loose any)
- **UI & Styling**: React 19, Tailwind CSS v4, Lucide React
- **Database**: Direct MySQL connection via `mysql2/promise` connection pool
- **No ORM**: Direct parameterized SQL inside the service layer (NO Prisma, NO Sequelize)
- **Validation**: Zod request & form schema validation
- **Authentication**: JWT token handling with `jose`, password hashing with `bcryptjs`, HTTP-only secure cookies
- **Barcode Generation**: `JsBarcode` (Code 128 standard)
- **Barcode Scanning**: `html5-qrcode` (Phone camera viewport with manual input fallback)
- **Route Interception**: `proxy.ts` request protection

---

## 📁 Project Architecture

The codebase enforces clean separation of concerns:
```
Page (app/*)
  → Reusable Component (components/*)
  → API Route (app/api/*)
  → Service Layer (services/*)
  → MySQL Connection (lib/db.ts)
  → MySQL Database
```

All reusable UI components are strictly centralized in `components/`:
- `components/ui/` (Button, Input, Textarea, Select, Checkbox, DateInput, Modal, ConfirmDialog, Card, Badge, Spinner, EmptyState, Tooltip)
- `components/layout/` (Sidebar, Header, PageHeader, AppShell)
- `components/data-display/` (DataTable, Pagination, FilterBar, StatusBadge, Timeline, StatsCard)
- `components/forms/` (FormField, FormSection, FileUpload, FormActions)
- `components/barcode/` (BarcodeGenerator, BarcodeScanner, BarcodePreview, BarcodePrint)

---

## 🗄️ Database Setup (MySQL)

1. Make sure MySQL Server is running locally on port 3306.
2. Execute the schema file in MySQL Workbench, phpMyAdmin, or MySQL CLI:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. The schema creates:
   - `users` (super_admin, admin, it_admin, employee)
   - `employees` (Staff members with unique IDs)
   - `assets` (Permanent asset number, serial, category, vendor, cost, status)
   - `asset_assignments` (Full custody chain without deleting history)
   - `asset_history` (Audit log of registrations, transfers, returns, maintenance, and status changes)
   - `asset_insurance` (Provider, policy number, dates, coverage, auto-status)
   - `asset_network` (IP, MAC, hostname, VLAN)
   - `tickets` (Linked to both Asset and Custodian)
   - `ticket_history` (Immutable status changes and comments)

### Default Administrator Account
- **Username**: `admin`
- **Password**: `Admin@123`
- **Role**: `super_admin`

---

## ⚙️ Configuration (.env)

Configure your MySQL credentials in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=asset_management
JWT_SECRET=production_ready_asset_management_jwt_secret_key_2026_x7912
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_NAME="AssetFlow Enterprise"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🏃 Running the Application

Install dependencies (if not already installed):
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Barcode Sticker Printing & Phone Scanning

1. **Printing**: Go to any Asset or the Assets list, click **"Print Sticker"** to open the print dialog. Supports thermal label printers and browser standard `@media print`.
2. **Scanning**: Click the **Scan Barcode** button in the header or sidebar (`/scan`).
   - Grant camera permissions to use your smartphone camera or webcam.
   - Align the Code 128 sticker within the viewfinder.
   - The scanner immediately sends the code to `/api/assets/scan`, verifies permissions, retrieves the MySQL asset record, and displays authorized actions (Raise Ticket, Reassign, View History).
