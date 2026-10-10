# WhatsApp-style Clone

React + Vite frontend prototype plus a separate Express/MongoDB backend API.

## Run the frontend
```bash
npm install
npm run dev
```

## Run the backend
See [`server/README.md`](server/README.md). In short:
```bash
cd server
cp .env.example .env
# Configure MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

The API runs on `http://localhost:5000`; check `http://localhost:5000/api/health`.

**Integration note:** the existing frontend still uses its local demo state and mock replies. The backend is provided as a separate API and is not yet wired into the current React screens. Use the API docs in `server/README.md` to connect the UI. This is a learning clone, not official WhatsApp, and does not implement end-to-end encryption.
