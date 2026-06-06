# 🚀 Unified Migration Plan: AutoZap ➔ SalonLink Pakistan

This plan outlines the integration of high-value legacy features from the "AutoZap" project into the modern "SalonLink" architecture.

## 1. Feature Migration: WhatsApp Bot
The legacy bot had highly specialized flows that need to be ported to the new `whatsapp-web.js` service.
- [ ] **"1234" Location Shortcut**: Port the area-based discovery flow to `ConversationService.ts`.
- [ ] **Referral System**: Integrate the referral code generation and point rewarding logic.
- [ ] **Rich Media Support**: Add the ability for the bot to send Salon Portfolio images and Media Gallery links.
- [ ] **Roman Urdu NLU**: Migrate the localized slang handlers to the new bot.

## 2. Database & Schema Alignment
The new Prisma schema is superior, but we need to ensure all legacy data points are covered.
- [ ] **Referral Codes**: Add `referralCode` to the `User` model in Prisma.
- [ ] **Staff Salaries**: Ensure the `salaries` logic from legacy `db.ts` is fully supported in `backend/src/services/owner.service.ts`.
- [ ] **Seat Management**: Migrate the "Seat" (Chair) availability logic for real-time salon monitoring.

## 3. Frontend Consolidation
The root Vite project and the `/frontend` Next.js project should be consolidated.
- [ ] **Dashboard Sync**: Bring the "Executive Summary" and "Staff Performance" charts from the legacy dashboard into the new Next.js Admin/Owner views.
- [ ] **Live QR**: Use the modern `LiveQRPage` in Next.js as the primary connection portal.

## 4. Operational Strategy
- [ ] **Unified Database**: Use the new `salonlink` database as the primary source of truth.
- [ ] **Legacy Redirects**: If any legacy APIs are still in use, point them to the new backend routes.

---

### **Immediate Action Taken:**
I am now implementing the **"1234" Location Flow** in the new `whatsapp-bot` project to maintain feature parity with the legacy system.
