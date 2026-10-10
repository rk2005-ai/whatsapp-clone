import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const phoneSchema = z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Use an international phone number, e.g. +919876543210');
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const tokenFor = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
export const requestOtp = asyncHandler(async (req, res) => {
  const parsed = z.object({ phone: phoneSchema, name: z.string().trim().min(2).max(60).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const { phone, name } = parsed.data;
  const otp = String(crypto.randomInt(100000, 1000000));
  let user = await User.findOne({ phone }).select('+otpHash +otpExpiresAt');
  if (!user) {
    if (!name) return res.status(400).json({ message: 'Name is required for a new account' });
    user = await User.create({ phone, name });
  } else if (name) {
    user.name = name;
  }
  user.otpHash = hash(otp);
  user.otpExpiresAt = new Date(Date.now() + Number(process.env.OTP_TTL_MINUTES || 10) * 60_000);
  await user.save();
  console.log(`[AUTH] Verification OTP for ${phone}: ${otp}`);
  res.json({
    message: 'Verification code generated',
    devOtp: otp,
    otp
  });
});
export const verifyOtp = asyncHandler(async (req, res) => {
  const parsed = z.object({ phone: phoneSchema, otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Valid phone and 6-digit code are required' });
  const { phone, otp } = parsed.data;
  const user = await User.findOne({ phone }).select('+otpHash +otpExpiresAt');

  if (!user) {
    return res.status(400).json({ message: 'Account not found. Please request a new verification code.' });
  }

  const isExpired = user.otpExpiresAt && new Date(user.otpExpiresAt).getTime() < Date.now();
  const isMatch = user.otpHash && user.otpHash === hash(otp);

  if (isExpired || !isMatch) {
    console.warn(`[AUTH] Invalid OTP attempt for ${phone}. Match: ${Boolean(isMatch)}, Expired: ${Boolean(isExpired)}`);
    return res.status(400).json({ message: 'Invalid or expired verification code' });
  }

  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save();
  console.log(`[AUTH] Verified successfully: ${user.name} (${user.phone})`);
  res.json({ token: tokenFor(user), user: user.toJSON() });
});
export const me = asyncHandler(async (req, res) => res.json({ user: req.user.toJSON() }));
