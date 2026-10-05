"use client";

/**
 * The countdown behind a "Resend code" button.
 *
 * Every OTP surface needs the same three things — a seconds-remaining number
 * for the label, a way to arm it after a send, and a disabled state while it
 * runs — and the timer was being written out longhand at each one.
 *
 * 60 seconds is not arbitrary: roam throttles the phone branch of
 * /auth/request-otp to one code per minute and answers 429 inside that window
 * (routes/auth.ts:135). Matching it here means the button is disabled for
 * exactly as long as pressing it would have failed. Codes sent over
 * /auth/phone/request-otp are NOT throttled server-side, so there this
 * countdown is the only thing standing between a stuck user and a bill for
 * every SMS and WhatsApp message they trigger.
 */

import { useEffect, useState } from "react";

export function useResendCooldown(seconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return {
    secondsLeft,
    /** True while pressing Resend would be refused. */
    waiting: secondsLeft > 0,
    /** Call after a code actually goes out — including the first one. */
    start: () => setSecondsLeft(seconds),
  };
}
