# WhatsApp Web Clone - Production Deployment Guide

This project is a full-stack, single-service WhatsApp Web clone with real-time Socket.io messaging and WebRTC video/audio calling.

---

## Option 1: Deploy on Render (Recommended - 100% Free)

Render provides free hosting with native WebSocket support and automatic SSL (required for mobile camera & mic).

### Steps:
1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/whatsapp-web-clone.git
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and log in.
   - Click **New +** $\to$ **Web Service**.
   - Select your GitHub repository.
   - Configure the service:
     - **Name**: `whatsapp-web-clone`
     - **Region**: Oregon (or nearest)
     - **Branch**: `main`
     - **Root Directory**: *(leave blank)*
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - Under **Environment Variables**, add:
     - `NODE_ENV`: `production`
     - `JWT_SECRET`: *(click Generate or enter a 32+ character random secret)*
     - `MONGODB_URI`: *(Optional: if you have MongoDB Atlas, add your URI here; otherwise, the app automatically uses the built-in embedded persistence engine!)*
   - Click **Create Web Service**.

3. **Done!** Render gives you a live HTTPS URL (e.g. `https://whatsapp-web-clone.onrender.com`).
   - Open this URL on your PC and mobile device.
   - Video and audio calling will work automatically!

---

## Option 2: Deploy on Railway

Railway supports instant deployment and persistent volumes.

### Steps:
1. Push your repository to GitHub.
2. Go to [railway.app](https://railway.app) and click **New Project** $\to$ **Deploy from GitHub repo**.
3. Select this repository.
4. Railway automatically detects `Procfile` / `package.json` and builds the project!
5. In **Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_random_secret_here`
6. In **Settings** $\to$ **Networking**, click **Generate Domain**.
7. Done!

---

## Option 3: Deploy via Docker

You can run the application anywhere Docker is installed:

```bash
docker build -t whatsapp-clone .
docker run -p 5000:5000 -e JWT_SECRET=random_secret whatsapp-clone
```
App will be live at `http://localhost:5000`.
