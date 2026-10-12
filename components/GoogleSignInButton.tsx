"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const GoogleSignInRunner = dynamic(
  () => import("@/components/GoogleSignInRunner"),
  { ssr: false },
);

// How long to wait for Clerk to load before letting the visitor retry.
const SIGN_IN_TIMEOUT_MS = 15_000;

export default function GoogleSignInButton() {
  // Mount Clerk as soon as the visitor shows intent (hover, focus, touch) so
  // it is usually ready by the time the click lands.
  const [warm, setWarm] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");

  const warmUp = () => setWarm(true);

  const signInWithGoogle = () => {
    if (isRedirecting) return;

    setError("");
    setWarm(true);
    setIsRedirecting(true);
  };

  const handleError = useCallback(() => {
    setError("ไม่สามารถเปิดหน้าล็อกอินได้ กรุณาลองอีกครั้ง");
    setIsRedirecting(false);
  }, []);

  useEffect(() => {
    if (!isRedirecting) return;

    const timer = window.setTimeout(handleError, SIGN_IN_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [isRedirecting, handleError]);

  return (
    <>
      <button
        aria-busy={isRedirecting}
        className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        disabled={isRedirecting}
        type="button"
        onClick={signInWithGoogle}
        onFocus={warmUp}
        onPointerEnter={warmUp}
        onTouchStart={warmUp}
      >
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
            fill="#4285F4"
          />
          <path
            d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
            fill="#34A853"
          />
          <path
            d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.95c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
            fill="#EA4335"
          />
        </svg>
        เข้าสู่ระบบด้วย Google
      </button>

      {warm && (
        <GoogleSignInRunner requested={isRedirecting} onError={handleError} />
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
