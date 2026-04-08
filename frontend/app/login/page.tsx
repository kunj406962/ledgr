"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Info } from "@/components/login/Info";
import { SignInForm } from "@/components/login/SignInForm";

export default function LoginPage() {
  const { session, loading, signInWithGoogle, signInWithGitHub } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState<"google" | "github" | null>(null);

  // Already logged in — go to dashboard
  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading, router]);

  const handleGoogle = async () => {
    setSigningIn("google");
    await signInWithGoogle();
    setSigningIn(null);
  };

  const handleGithub = async () => {
    setSigningIn("github");
    await signInWithGitHub();
    setSigningIn(null);
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Theme toggle - top right on mobile, hidden on desktop */}
      <div className="absolute top-4 right-4 md:hidden">
        <ThemeToggle />
      </div>
      
      {/* Left side - Hero (desktop only) */}
      <Info />
      
      {/* Right side - Login form */}
      <SignInForm handleGoogle={handleGoogle} handleGithub={handleGithub} signingIn={signingIn} />
    </div>
  );
}