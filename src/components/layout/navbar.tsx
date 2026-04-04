"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#models", label: "Models" },
  { href: "/pricing", label: "Pricing" },
  { href: "#api", label: "API" },
];

export function Navbar() {
  const { isSignedIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-violet-600/20">
                G
              </div>
              <span className="text-lg font-bold gradient-text">
                Genesis Studio
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {!isSignedIn ? (
                <>
                  <Link href="/sign-in" className="hidden sm:block">
                    <Button variant="ghost" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button size="sm">
                      Get Started Free <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard">
                    <Button variant="secondary" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                  <UserButton
                    appearance={{
                      elements: { avatarBox: "w-8 h-8 rounded-lg" },
                    }}
                  />
                </>
              )}

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 text-zinc-400 hover:text-white"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-16 left-0 right-0 glass-strong border-b border-white/[0.06] p-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!isSignedIn && (
                <Link
                  href="/sign-in"
                  className="px-4 py-3 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
