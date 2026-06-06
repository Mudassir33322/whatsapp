# Security Specification - AutoZap Enterprise

## 1. Data Invariants
- A `whatsappSession` must belong to a valid `userId`.
- Only the `userId` associated with a session can view its QR code or status.
- Bookings must have a valid `customerPhone` and `appointmentTime`.
- Customers in CRM are scoped to a `userId`.

## 2. The Dirty Dozen Payloads (Rejection Targets)
1. **Hijack Session**: User B trying to write to `/sessions/session-A` where session-A belongs to User A.
2. **Ghost Session**: Creating a session with a null or invalid `userId`.
3. **Identity Spoof**: Setting the `userId` field to another user's ID during creation.
4. **Invalid Type**: Sending a string for `battery` level.
5. **Admin Injection**: Adding an `isAdmin: true` field to a user profile.
6. **Orphaned Booking**: Creating a booking for a non-existent customer.
7. **Negative Battery**: Setting `battery` to -50.
8. **Malicious QR**: Injecting a 2MB base64 string into `lastQr`.
9. **Future Piling**: Creating 1000 bookings in a single batch (Rate limiting).
10. **ID Poisoning**: Using a 500-character string as a `sessionId`.
11. **State Shortcut**: Changing booking status from `pending` to `completed` without transitioning through `confirmed`.
12. **Public PII Leak**: Reading `/users/X/customers/Y` without being authenticated as User X.

## 3. Test Runner (Draft)
- `it('rejects cross-user session write')` -> Expect PERMISSION_DENIED.
- `it('validates battery range')` -> Expect PERMISSION_DENIED if > 100 or < 0.
