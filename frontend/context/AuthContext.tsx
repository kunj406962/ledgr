"use client";

import {createContext, useContext, useEffect, useState, useCallback, ReactNode} from "react";
import { Session, User } from "@supabase/supabase-js";
import {supabase} from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserProfile{
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    home_currency: string;
}

interface AuthContextValue{
    // State
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;

    //Actions
    signInWithGoogle: ()=> Promise<void>;
    signInWithGitHub: ()=> Promise<void>;
    signOut: ()=> Promise<void>;

    //Helper - used to make authenticated API  calls
    getAccessToken: ()=> string | null;
}

// ── Context Creation ─────────────────────────────────────────────────────────
const AuthContext= createContext<AuthContextValue | null>(null);

// ── Provider Component ───────────────────────────────────────────────────────
export function AuthProvider({children}: {children: ReactNode}) {
    const [session, setSession]= useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch our backend profile once we have a session
    const fetchProfile = useCallback(async (accessToken: string) => {
    try {
        console.log("Fetching profile with token:", accessToken.slice(0, 20) + "...");
        const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log("Profile response status:", res.status);
        if (!res.ok) return;
        const data: UserProfile = await res.json();
        console.log("Profile data:", data);
        setProfile(data);
    } catch (err) {
        console.error("Profile fetch failed:", err);
    }
    }, []);
    
    // On mount: get the current session, then listen for changes
    useEffect(()=>{
        supabase.auth.getSession().then(({data: {session}})=>{
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.access_token) fetchProfile(session.access_token);
            setLoading(false);
        })

        const {data: {subscription}} = supabase.auth.onAuthStateChange(
            (_event, session)=>{
                setSession(session);
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.access_token) {
                    fetchProfile(session.access_token);
                } else {
                    setProfile(null);
                }
            }
        )

        return ()=> subscription.unsubscribe();
    }, [fetchProfile]);

    
  // ── Auth actions ────────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const getAccessToken = () => session?.access_token ?? null;

  return (
    <AuthContext.Provider value={{session, user, profile, loading, signInWithGoogle, signInWithGitHub, signOut, getAccessToken}}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
 
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}