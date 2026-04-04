"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen, setUser } = useStore();

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/user");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    }
    loadUser();
  }, [setUser]);

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
