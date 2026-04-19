/**
 * Tiny module-scope store for the PhoneConfirmation handle.
 *
 * We can't pass the handle through router params (non-serializable), and
 * AsyncStorage is overkill for something that lives ~60 seconds. A module
 * variable is fine — only one OTP flow runs at a time.
 *
 * NOTE: handle ki type intentionally `any` rakhi hai kyunki:
 *   - Native pe ye @react-native-firebase ka ConfirmationResult hota hai
 *   - Web pe firebase/auth Web SDK ka ConfirmationResult hota hai
 *   Dono structurally same hain (.confirm(code) method), bas TS types alag.
 */

let handle: any = null;
let phone: string = "";

export function setPhoneHandle(h: any, p: string): void {
  console.log("[otp-handle] setPhoneHandle called. phone =", p);
  handle = h;
  phone = p;
}

export function getPhoneHandle(): any {
  return handle;
}

export function getPhone(): string {
  return phone;
}

export function clearPhoneHandle(): void {
  console.log("[otp-handle] clearPhoneHandle called");
  handle = null;
  phone = "";
}

/**
 * Backwards-compat type alias — `lib/auth.ts` still imports `PhoneConfirmation`
 * from itself, so we don't need to re-export anything here. If any old code
 * imports a type from this file, we expose a loose alias.
 */
export type PhoneHandle = any;
