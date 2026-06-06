# AutoZap Enterprise - Data Flow & Database Documentation

## 🗄️ Database
All application data is stored in a single JSON file:
- **Location:** `database.json` (in the root directory)
- **Format:** JSON Array/Object structure.
- **Backup:** You can simply copy `database.json` to back up all your customers, bookings, finances, and settings.

## 🔄 Data Flow (How it works)

### 1. Booking Flow (WhatsApp -> Dashboard)
1. **Customer** sends a message on WhatsApp.
2. **Baileys (WhatsApp Engine)** receives the message in `server.ts`.
3. **Bot Logic (`bot.ts`)** processes the message:
   - Recognizes "aj" (today), "kal" (tomorrow), or dates.
   - Asks for service, date, and time.
4. **Database (`db.ts`)** saves the new booking into `database.json`.
5. **Socket.IO** immediately notifies the **Frontend (Dashboard)**.
6. **Bookings Page (`Bookings.tsx`)** refreshes automatically and shows the new appointment with a token.

### 2. Live Chat Flow
1. **Admin** types a message in the **Live Inbox**.
2. **Socket.IO** sends the `send-message` event to the server.
3. **Server** uses Baileys to send the actual WhatsApp message.
4. **Server** also saves the message to `database.json` so you can see history later.

### 3. Financial Tracking
1. When you **Mark as Complete** a booking, it adds a "Revenue" entry.
2. When you **Sell a Product**, it decrements stock and adds a "Revenue" entry.
3. When you add a **New Expense**, it saves to the expenses list.
4. The **Finances Page** aggregates all these entries from `database.json` to show total Profit/Loss.

## 🚀 Portability
To run this on another PC:
1. Install [Node.js](https://nodejs.org/).
2. Copy the entire folder to the new PC.
3. Double-click `run-app.bat`.
4. It will install everything and start the app.
