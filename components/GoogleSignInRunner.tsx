"use client";

import { useEffect, useRef } from "react";
import { useSignIn } from "@clerk/nextjs";

import ConfiguredClerkProvider from "@/components/ConfiguredClerkProvider";

type RunnerProps = {
  requested: boolean;
  onError: () => void;
};

function StartGoogleSignIn({ requested, onError }: RunnerProps) {
  const { isLoaded, signIn } = useSignIn();
  const started = useRef(false);

  useEffect(() => {
    if (!requested || !isLoaded || !signIn || started.current) return;

    started.current = true;
    signIn
      .authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/api/auth/sync-session",
      })
      .catch(() => {
        started.current = false;
        onError();
      });
  }, [requested, isLoaded, signIn, onError]);

  return null;
}

// Loaded only after the visitor shows intent to sign in, so the Clerk runtime
// stays out of the home page's initial JavaScript.
export default function GoogleSignInRunner(props: RunnerProps) {
  return (
    <ConfiguredClerkProvider>
      <StartGoogleSignIn {...props} />
    </ConfiguredClerkProvider>
  );
}
