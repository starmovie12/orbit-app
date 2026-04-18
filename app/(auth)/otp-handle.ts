/**
 * Tiny module-scope store for the PhoneConfirmation handle.
 *
 * We can't pass the handle through router params (non-serializable), and
 * AsyncStorage is overkill for something that lives ~60 seconds. A module
 * variable is fine — only one OTP flow runs at a time.
 */

import type { PhoneConfirmation } from "@/lib/auth";

let handle: PhoneConfirmation | null = null;
let phone: string = "";

export function setPhoneHandle(h: PhoneConfirmation, p: string) {
  handle = h;
  phone = p;
}

export function getPhoneHandle(): PhoneConfirmation | null {
  return handle;
}

export function getPhone(): string {
  return phone;
}

export function clearPhoneHandle() {
  handle = null;
  phone = "";
}
