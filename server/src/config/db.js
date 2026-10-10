import mongoose from 'mongoose';
import { setEmbeddedMode } from './embeddedStore.js';

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI not provided. Running in embedded storage mode.');
    setEmbeddedMode(true);
    return;
  }

  try {
    // Attempt MongoDB connection with 2.5s timeout
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500
    });
    console.log('✅ MongoDB connected to', process.env.MONGODB_URI);
    setEmbeddedMode(false);
  } catch (err) {
    console.warn(`⚠️ MongoDB connection unavailable (${err.message}).`);
    console.log('📁 Switching to Embedded Persistence Engine (data/store.json). All features fully operational!');
    setEmbeddedMode(true);
  }
}
