"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ref as dbRef, onValue, set } from "firebase/database";
import { db } from "@/lib/firebase";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  // The password that passed verify, sent again with pause and reset.
  const enteredPassword = useRef("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDebateActive, setIsDebateActive] = useState<boolean | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [caInput, setCaInput] = useState("");
  const [twitterInput, setTwitterInput] = useState("");
  const [savingCa, setSavingCa] = useState(false);
  const [savingTwitter, setSavingTwitter] = useState(false);
  const [caStatus, setCaStatus] = useState<string | null>(null);
  const [twitterStatus, setTwitterStatus] = useState<string | null>(null);

  useEffect(() => {
    const configRef = dbRef(db, "config/isDebateActive");
    const u1 = onValue(configRef, (snap) => {
      setIsDebateActive(snap.exists() ? snap.val() : true);
    });
    const u2 = onValue(dbRef(db, "config/caText"), (snap) => {
      setCaInput(snap.exists() ? snap.val() : "");
    });
    const u3 = onValue(dbRef(db, "config/twitterUrl"), (snap) => {
      setTwitterInput(snap.exists() ? snap.val() : "");
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const handleAuth = async () => {
    setIsAuthenticating(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        enteredPassword.current = password;
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Wrong password.");
      }
    } catch {
      setAuthError("Could not reach server.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const toggleDebate = async (active: boolean) => {
    try {
      const action = active ? "resume" : "pause";
      const res = await fetch("/api/admin/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enteredPassword.current, action }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error("Failed to toggle debate:", data.error);
      }
    } catch (error) {
      console.error("Failed to update debate status:", error);
    }
  };

  const saveCaText = async () => {
    setSavingCa(true);
    try {
      await set(dbRef(db, "config/caText"), caInput);
      setCaStatus("✓ Saved!");
    } catch {
      setCaStatus("Error saving.");
    } finally {
      setSavingCa(false);
      setTimeout(() => setCaStatus(null), 2000);
    }
  };

  const saveTwitterUrl = async () => {
    setSavingTwitter(true);
    try {
      await set(dbRef(db, "config/twitterUrl"), twitterInput);
      setTwitterStatus("✓ Saved!");
    } catch {
      setTwitterStatus("Error saving.");
    } finally {
      setSavingTwitter(false);
      setTimeout(() => setTwitterStatus(null), 2000);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "This will erase ALL conversations, commandments and confessions and restart from Day 1. Are you sure?",
      )
    )
      return;
    setIsResetting(true);
    setResetStatus(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enteredPassword.current }),
      });
      const data = await res.json();
      if (data.success) {
        setResetStatus("✓ Reset complete. The council has returned to Day 1.");
      } else {
        setResetStatus(`Error: ${data.error}`);
      }
    } catch (e: unknown) {
      setResetStatus(`Error: ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setIsResetting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full bg-[#030303] min-h-screen text-neutral-200 flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
        <div className="relative z-10 flex flex-col gap-6 items-center w-full max-w-sm px-8">
          <h1 className="text-sm font-serif text-neutral-400 font-medium tracking-[0.3em] uppercase">
            Council Admin
          </h1>
          <p className="text-[10px] tracking-[0.2em] text-neutral-600 uppercase font-sans">
            Enter password to continue
          </p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isAuthenticating && handleAuth()}
            className="w-full bg-black border border-neutral-800 focus:border-neutral-500 text-neutral-200 font-mono text-sm px-4 py-3 outline-none tracking-wider placeholder:text-neutral-700"
          />
          {authError && (
            <p className="text-red-500 text-[10px] tracking-widest uppercase font-sans">
              {authError}
            </p>
          )}
          <button
            onClick={handleAuth}
            disabled={isAuthenticating}
            className={`w-full py-3 border border-neutral-700 text-neutral-300 text-xs font-sans tracking-[0.3em] uppercase transition-all ${isAuthenticating ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-900"}`}
          >
            {isAuthenticating ? "Verifying..." : "Enter the Chamber"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#030303] min-h-screen text-neutral-200 selection:bg-neutral-800 p-8 md:p-20 relative">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />

      <Link
        href="/"
        className="text-[9px] tracking-[0.3em] text-neutral-600 uppercase font-sans hover:text-neutral-400 transition-colors mb-10 block"
      >
        &larr; Back to Council Chamber
      </Link>

      <div className="max-w-xl mx-auto relative z-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-sm font-serif text-neutral-400 font-medium tracking-[0.3em] uppercase">
            Council Admin
          </h1>
          <p className="text-[10px] tracking-[0.15em] text-neutral-700 uppercase font-sans">
            Full control over the debate engine
          </p>
        </div>

        <div className="flex flex-col p-8 border border-neutral-900 bg-black/50 backdrop-blur rounded-sm gap-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.3em] font-sans uppercase text-neutral-500">
              Debate Engine
            </span>
            {isDebateActive !== null && (
              <div
                className={`px-3 py-0.5 border text-[10px] font-mono tracking-wider uppercase ${isDebateActive ? "bg-red-900/10 border-red-900/50 text-red-500" : "bg-neutral-900 border-neutral-800 text-neutral-500"}`}
              >
                {isDebateActive ? "DEBATING" : "PAUSED"}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => toggleDebate(true)}
              disabled={isDebateActive === true}
              className={`flex-1 py-3 tracking-[0.3em] uppercase text-[10px] font-medium border transition-all ${isDebateActive ? "border-neutral-900 text-neutral-700 opacity-50 cursor-not-allowed" : "border-red-900/50 bg-red-900/10 text-red-500 hover:bg-red-900/20"}`}
            >
              Start
            </button>
            <button
              onClick={() => toggleDebate(false)}
              disabled={isDebateActive === false}
              className={`flex-1 py-3 tracking-[0.3em] uppercase text-[10px] font-medium border transition-all ${!isDebateActive ? "border-neutral-900 text-neutral-700 opacity-50 cursor-not-allowed" : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"}`}
            >
              Stop
            </button>
          </div>
        </div>

        <div className="flex flex-col p-6 border border-neutral-900 bg-black/50 backdrop-blur rounded-sm gap-4">
          <span className="text-[10px] tracking-[0.3em] font-sans uppercase text-neutral-500">
            CA Address (Header)
          </span>
          <p className="text-[10px] text-neutral-600 font-sans">
            Shown in the header center. Click to copy. Set to TBA if not yet launched.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={caInput}
              onChange={(e) => setCaInput(e.target.value)}
              placeholder="e.g. 0x1234...abcd or TBA"
              className="flex-1 bg-black border border-neutral-800 focus:border-neutral-500 text-neutral-200 font-mono text-xs px-3 py-2 outline-none"
            />
            <button
              onClick={saveCaText}
              disabled={savingCa}
              className="px-4 py-2 border border-neutral-700 text-neutral-300 text-[10px] uppercase tracking-widest hover:bg-neutral-900 transition-all disabled:opacity-50"
            >
              {savingCa ? "..." : "Save"}
            </button>
          </div>
          {caStatus && (
            <p
              className={`text-[10px] uppercase tracking-wider font-sans ${caStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}
            >
              {caStatus}
            </p>
          )}
        </div>

        <div className="flex flex-col p-6 border border-neutral-900 bg-black/50 backdrop-blur rounded-sm gap-4">
          <span className="text-[10px] tracking-[0.3em] font-sans uppercase text-neutral-500">
            Twitter / X Link (Header)
          </span>
          <p className="text-[10px] text-neutral-600 font-sans">
            The URL the X icon in the header will open.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={twitterInput}
              onChange={(e) => setTwitterInput(e.target.value)}
              placeholder="https://x.com/yourhandle"
              className="flex-1 bg-black border border-neutral-800 focus:border-neutral-500 text-neutral-200 font-mono text-xs px-3 py-2 outline-none"
            />
            <button
              onClick={saveTwitterUrl}
              disabled={savingTwitter}
              className="px-4 py-2 border border-neutral-700 text-neutral-300 text-[10px] uppercase tracking-widest hover:bg-neutral-900 transition-all disabled:opacity-50"
            >
              {savingTwitter ? "..." : "Save"}
            </button>
          </div>
          {twitterStatus && (
            <p
              className={`text-[10px] uppercase tracking-wider font-sans ${twitterStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}
            >
              {twitterStatus}
            </p>
          )}
        </div>

        <div className="flex flex-col p-8 border border-red-900/30 bg-black/50 backdrop-blur rounded-sm gap-4">
          <span className="text-[10px] tracking-[0.3em] font-sans uppercase text-red-700">
            Danger Zone
          </span>
          <p className="text-neutral-500 text-xs leading-relaxed font-sans">
            This will permanently erase{" "}
            <strong className="text-neutral-400">
              all discussions, commandments and confessions
            </strong>{" "}
            and restart the debate from Day 1, Hour 0.
          </p>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="w-full py-3 border border-red-900/50 text-red-600 text-xs font-sans tracking-[0.3em] uppercase hover:bg-red-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? "Resetting..." : "Reset Everything → Restart Day 1"}
          </button>
          {resetStatus && (
            <p
              className={`text-[10px] tracking-wider font-sans uppercase text-center ${resetStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}
            >
              {resetStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
