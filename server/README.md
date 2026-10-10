# WhatsApp Clone API

REST API + Socket.IO backend using Express, MongoDB/Mongoose, JWT authentication, input validation, rate limiting, and protected conversation/message endpoints.

## Requirements
- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

## Start locally
```bash
cd server
cp .env.example .env
# Set MONGODB_URI and a long random JWT_SECRET in .env
npm install
npm run dev
```
API health check: `GET http://localhost:5000/api/health`

## Authentication flow
1. `POST /api/auth/request-otp` with `{ "name": "Rohan", "phone": "+919876543210" }` for a new account (existing users can send phone only).
2. In development, response includes `devOtp`. This is intentionally omitted in production; configure an SMS provider before production use.
3. `POST /api/auth/verify-otp` with `{ "phone": "+919876543210", "otp": "123456" }` returns `{ token, user }`.
4. Send `Authorization: Bearer <token>` on protected endpoints.

## Main endpoints
- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/users?q=ro` — search users (minimum 2 characters)
- `GET /api/conversations`
- `POST /api/conversations` — `{ "participantIds": ["userObjectId"], "isGroup": false }`
- `GET /api/conversations/:id/messages?limit=50&before=<ISO-date>`
- `POST /api/conversations/:id/messages` — `{ "text": "Hello" }`
- `PATCH /api/conversations/:id/messages/:messageId` — edit own message
- `DELETE /api/conversations/:id/messages/:messageId` — delete own message for everyone

## Socket.IO
Connect with `io(API_URL, { auth: { token } })`. Events: `conversation:join`, `typing:start`, `typing:stop`; server emits `message:new`, `message:updated`, `message:deleted`, `typing:update`, and `presence:update`. Conversation membership is checked before joining or starting typing.

## Production checklist
- Integrate an SMS OTP provider; never return OTPs in production.
- Set `NODE_ENV=production`, strong unique `JWT_SECRET`, and restrictive `CLIENT_ORIGIN`.
- Use HTTPS, secure upload storage and file scanning, backups, monitoring, and a secrets manager.
- Add OTP attempt counters/lockouts and phone verification abuse controls before public launch.
- This is a WhatsApp-style learning clone, not the official WhatsApp service; messages are not end-to-end encrypted.
