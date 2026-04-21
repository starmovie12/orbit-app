/**
 * app/(auth)/otp-handle.tsx
 * 
 * 📍 Location: app/(auth)/otp-handle.tsx
 * ⚠️  Delete the old otp-handle.ts file, use this .tsx instead
 * 
 * This file handles the OTP verification result and redirects accordingly.
 * If this was utility logic, it has been moved here as a proper screen.
 */

import { Redirect } from "expo-router";

export default function OtpHandle() {
  // Redirect to the OTP screen for now.
  // Replace this with your actual OTP handling logic if needed.
  return <Redirect href="/(auth)/otp" />;
}
