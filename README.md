# ⛽ Fuel Master - Enterprise SaaS Fuel Management

<p align="center">
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS" />
  <img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
</p>

> A comprehensive, full-stack MERN (MongoDB, Express.js, React, Node.js) application engineered to modernize and secure fuel station operations. Moving beyond standard CRUD functionality, this system provides enterprise-grade tools for dynamic inventory routing, point-of-sale (POS) transactions, shift reconciliation, supply chain management, and immutable security auditing.

---

## ✨ Enterprise Features

* **🛡️ Advanced Role-Based Access Control (RBAC)-** Secure JWT authentication with strict route protection. Features a persistent **Super Admin** that cannot be deleted or suspended. Standard Admins have full system access, while Staff members are restricted to operational tasks.
* **📱 100% Mobile Responsive UI/UX-** The entire system is built with a responsive glassmorphism aesthetic. From data tables to dynamic grid dashboards, everything perfectly scales for tablets and smartphones.
* **👤 Complete Identity Management & GDPR-** Users can manage their credentials, upload profile avatars using native `FileReader` Base64 encoding, and generate raw JSON GDPR Data Exports of their identity and system footprint.
* **📊 Live Analytics & Dashboard-** Real-time tank level monitoring with visual progress bars and dynamic revenue charts utilizing `Recharts`, populated instantly via WebSockets (`socket.io`).
* **💳 POS & Shift Reconciliation (Z-Reports)-** A highly secure sales terminal requiring staff to open/close shifts. The system automatically calculates expected revenue vs physical cash variances, generating printable End-of-Shift Z-Reports.
* **📦 Complete Inventory Lifecycle-** Full administrative control to register new fuel tanks, update pricing, transfer fuel cross-pump, or permanently decommission fuel types. 
* **🛑 Manager PIN Overrides-** Critical destructive actions (e.g., deleting a tank, voiding a transaction, or resetting passwords) are locked behind a secure Manager PIN overlay for operational safety.
* **🚚 Smart Supply Chain Logging-** Dedicated module to record incoming fuel deliveries. Adding or deleting a delivery record automatically cascades into the database to mathematically adjust live tank volumes.
* **📑 Automated PDF/CSV Reporting-** Instantly generate professionally formatted PDF reports (via `jsPDF`) and native CSV data exports for accounting integration across all data tables.
* **🔒 Immutable Forensic Audit Trail-** A security ledger that silently records sensitive administrative actions (logins, price changes, overrides, deletions) tracking timestamps, users, actions, and network/device signatures for complete accountability.
* **🔔 Global Notification System-** All legacy browser popups have been completely replaced with elegant, non-blocking `react-hot-toast` alerts and custom React-based confirm/danger modals.
* **🌗 Intelligent Theme Engine-** Fully integrated Light/Dark mode toggling with persistent user preference storage.
* **✨ Fluid Animations-** Seamless page transitions, modal scaling, and data entry animations powered by `Framer Motion`.
## 🛠️ Technical Architecture

**Frontend (Client)**
* **React.js** (Vite compiler for optimized builds)
* **Tailwind CSS v4** (Utility-first styling & modern UI/UX)
* **Recharts** (Data Visualization)
* **jsPDF & jsPDF-AutoTable** (Client-side PDF Generation)
* **Lucide React** (Scalable vector iconography)
* **React Hot Toast** (Global notification system)
* **Socket.io-client** (Real-time data synchronization)

**Backend (API)**
* **Node.js & Express.js** (Configured for 10MB+ payload processing)
* **MongoDB Atlas & Mongoose** (NoSQL Database & Object Data Modeling)
* **JSON Web Tokens (JWT) & bcryptjs** (Stateless Authentication & Cryptography)
* **Socket.io** (WebSockets for live dashboard and audit updates)

---

## 🚀 Installation & Local Setup

### Prerequisites
Ensure you have the following installed on your local environment:
* **[Node.js](https://nodejs.org/)** (v18 or higher)
* **[Git](https://git-scm.com/)**
* **[MongoDB Atlas](https://www.mongodb.com/atlas)** account (or a local MongoDB instance)

### 1️⃣ Clone the Repository
First, clone the repository to your local machine and navigate into the root project directory:
```bash
# Clone the repo
git clone https://github.com/ChandikaWi/fuel-management-system.git

# Navigate into the directory
cd fuel-management-system
```

### 2️⃣ Backend Setup (API)
Open your terminal and configure the backend server:

```bash
# Navigate to the backend directory
cd server

# Install required dependencies
npm install
```

**Environment Configuration:**
Create a `.env` file in the root of the `/server` directory and add your secure credentials:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_cryptographic_key
```

**Start the Backend Server:**
```bash
# Run the server in development mode
npm run dev
```
*(You should see `Server running on port 5000` and `MongoDB Connected` in your terminal).*

### 3️⃣ Frontend Setup (Client)
Open a new terminal window (leave the backend running) and configure the frontend client:

```bash
# From the root project folder, navigate to the frontend directory
cd client

# Install required dependencies
npm install

# Start the Vite development server
npm run dev
```
*(The application will typically be accessible at `http://localhost:5173/`).*

---

## 🔑 Default Credentials

If your database is empty, the system will automatically generate a Super Admin account upon the first startup. You can log in using:

* **Username:** `Admin` (or whatever you configure as your primary admin)
* **Password:** `admin123` (or check your database configuration if seeding manually)

*Note: It is highly recommended to change the password immediately after the first login via the Profile page.*

---

## 🧠 Design Philosophy
This project was developed with a decoupled, API-driven architecture. The RESTful backend utilizes isolated controllers, modular routing, and custom authentication middleware to ensure data integrity before any database mutation occurs. The frontend consumes this API using a custom Axios instance equipped with HTTP interceptors to handle token expiration seamlessly. Real-time updates via WebSockets ensure all dashboards remain instantly synchronized across multiple terminals.

---
**Developed by A.G.Chandika Wickramasena**