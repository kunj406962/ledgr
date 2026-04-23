// app/(authenticated)/layout.tsx
'use client';
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SideBar } from "@/components/ui/SideBar";
import { MobileNav } from "@/components/ui/MobileNav";
import { MobileHeader } from "@/components/ui/MobileHeader";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();
  const router = useRouter();

  // Derive isAuthenticated from session
  const isAuthenticated = !!session;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block sticky top-0 h-screen flex-shrink-0">
        <SideBar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <MobileHeader />
        
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}