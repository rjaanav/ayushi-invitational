"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { sendOtp, verifyOtp, firebaseUser, player, loading, configured } =
    useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser) {
      if (!player?.name || !player?.photoURL) router.replace("/onboarding");
      else router.replace("/");
    }
  }, [firebaseUser, player, loading, router]);

  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error("Firebase not configured yet. Check README.");
      return;
    }
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 8) {
      toast.error("Enter a valid phone number.");
      return;
    }
    const full = `${countryCode}${clean}`;
    try {
      setSending(true);
      await sendOtp(full);
      toast.success(`Code sent to ${full}`);
      setStep("otp");
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to send code. Try again."
      );
    } finally {
      setSending(false);
    }
  }

  async function onVerify(code?: string) {
    const full = code ?? otp.join("");
    if (full.length !== 6) return;
    try {
      setVerifying(true);
      await verifyOtp(full);
      toast.success("You're in! 🎾");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "That code didn't work. Try again."
      );
      setOtp(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-4">
        <Link href="/" className="inline-flex items-center gap-2 text-ink-soft text-sm">
          <ArrowLeft size={16} /> back
        </Link>
      </div>
      <div className="flex-1 px-5 pt-10 pb-6 flex flex-col gap-6">
        <div>
          <Logo />
          <h1 className="font-display text-3xl mt-6 leading-tight">
            {step === "phone" ? (
              <>
                Welcome to
                <br /> Ayushi&rsquo;s night.
              </>
            ) : (
              <>Check your phone.</>
            )}
          </h1>
          <p className="text-sm text-muted mt-2 max-w-xs">
            {step === "phone"
              ? "We send a one-time code to verify it's really you. No passwords, no spam."
              : `We texted a 6-digit code to ${countryCode}${phone}.`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "phone" && (
            <motion.form
              key="phone"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={onSendOtp}
              className="flex flex-col gap-3"
            >
              <div className="card p-1 flex items-center gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-transparent px-3 py-3 rounded-l-xl font-semibold outline-none"
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+65">🇸🇬 +65</option>
                </select>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="99900 99900"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="flex-1 bg-transparent px-2 py-3 text-lg outline-none"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={16} />
                )}
                Send my code
              </button>
              <p className="text-[11px] text-muted text-center px-6">
                By continuing you agree to receive a one-time verification SMS.
                Your number is never shared.
              </p>
            </motion.form>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex gap-2 justify-between">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    value={digit}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(-1);
                      const next = [...otp];
                      next[i] = v;
                      setOtp(next);
                      if (v && i < 5) inputsRef.current[i + 1]?.focus();
                      if (v && i === 5) onVerify(next.join(""));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) {
                        inputsRef.current[i - 1]?.focus();
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      if (!text) return;
                      e.preventDefault();
                      const arr = text.split("").concat(Array(6).fill("")).slice(0, 6);
                      setOtp(arr);
                      if (text.length === 6) onVerify(text);
                      else inputsRef.current[Math.min(text.length, 5)]?.focus();
                    }}
                    inputMode="numeric"
                    maxLength={1}
                    className="w-12 h-14 text-center font-display text-2xl rounded-2xl border border-black/10 bg-white focus:border-court-700 focus:ring-4 focus:ring-court-600/10 outline-none"
                  />
                ))}
              </div>
              <button
                onClick={() => onVerify()}
                disabled={verifying || otp.join("").length !== 6}
                className="btn btn-primary"
              >
                {verifying ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Verify"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp(["", "", "", "", "", ""]);
                }}
                className="btn btn-ghost"
              >
                Change number
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div id="recaptcha-container" />
    </div>
  );
}
