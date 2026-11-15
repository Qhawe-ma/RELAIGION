"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/language-context";

type Commandment = {
  text: string;
  textZh?: string;
  topic: string;
  topicZh?: string;
  date: string;
  dayNumber: number;
};

export default function ScripturePage() {
  const { language, t } = useLanguage();
  const [commandments, setCommandments] = useState<Commandment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Commandment | null>(null);

  useEffect(() => {
    const cmdRef = ref(db, "commandments");
    const unsub = onValue(cmdRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = (Object.values(data) as Commandment[]).sort(
          (a, b) => (a.dayNumber || 0) - (b.dayNumber || 0),
        );
        setCommandments(list);
      } else {
        setCommandments([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="w-full bg-[#030303] min-h-screen text-neutral-200 selection:bg-neutral-800 relative pb-40">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,1)]" />

      <header className="w-full px-6 sm:px-12 py-8 border-b border-neutral-900/50">
        <Link
          href="/"
          className="text-[9px] tracking-[0.3em] text-neutral-600 uppercase font-sans hover:text-neutral-400 transition-colors"
        >
          ← {t("councilChamber")}
        </Link>
        <div className="mt-6 flex flex-col gap-2">
          <h1 className="text-2xl sm:text-4xl font-serif text-neutral-200 tracking-tight">
            {t("theScripture")}
          </h1>
          <p className="text-xs sm:text-sm font-sans text-neutral-600 tracking-[0.2em] uppercase">
            10 {t("commandments")} · {t("forgedByDebate")} · {t("writtenByAI")}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-12 pt-16 relative z-10">
        {loading && (
          <div className="flex justify-center items-center pt-32">
            <span className="text-[10px] tracking-[0.4em] text-neutral-700 uppercase font-sans animate-pulse">
              {t("loadingScripture")}
            </span>
          </div>
        )}

        {!loading && commandments.length === 0 && (
          <div className="flex flex-col items-center gap-6 pt-32 text-center">
            <div className="w-px h-24 bg-gradient-to-b from-transparent to-neutral-800 mx-auto" />
            <p className="text-xs tracking-[0.3em] text-neutral-700 uppercase font-sans">
              {t("noCommandmentsYet")}
            </p>
            <p className="text-2xl font-serif text-neutral-600 italic">
              {t("firstCommandmentBeingForged")}
            </p>
            <p className="text-[10px] text-neutral-700 font-sans tracking-widest uppercase">
              {t("checkBackAfter24h")}
            </p>
          </div>
        )}

        {!loading && commandments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((dayNum) => {
              const cmd = commandments.find((c) => c.dayNumber === dayNum);
              return (
                <motion.div
                  key={dayNum}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dayNum * 0.07, duration: 0.8, ease: "easeOut" }}
                >
                  {cmd ? (
                    <button
                      onClick={() => setSelected(cmd)}
                      className="w-full text-left group relative"
                    >
                      <div className="relative p-8 sm:p-10 border border-neutral-800 bg-gradient-to-b from-neutral-900/40 to-black/60 hover:border-neutral-600 hover:from-neutral-900/70 transition-all duration-700 rounded-sm overflow-hidden">
                        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22100%22%20height=%22100%22%3E%3Cfilter%20id=%22noise%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.65%22%20numOctaves=%223%22%20stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect%20width=%22100%25%22%20height=%22100%25%22%20filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

                        <div className="mb-6 flex items-center gap-3">
                          <span className="text-[9px] tracking-[0.3em] text-neutral-600 uppercase font-sans">
                            {t("commandment")}
                          </span>
                          <div className="h-px flex-1 bg-neutral-800" />
                          <span className="text-xs font-mono text-neutral-600">
                            {toRoman(dayNum)}
                          </span>
                        </div>

                        <p className="text-lg sm:text-xl font-serif text-neutral-300 leading-relaxed italic group-hover:text-neutral-100 transition-colors duration-500 mb-6">
                          &quot;{language === "zh" && cmd.textZh ? cmd.textZh : cmd.text}&quot;
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[9px] tracking-[0.15em] text-neutral-600 uppercase font-sans max-w-[180px] truncate">
                            {language === "zh" && cmd.topicZh ? cmd.topicZh : cmd.topic}
                          </span>
                          <span className="text-[9px] tracking-[0.15em] text-neutral-700 font-sans shrink-0">
                            {t("day")} {dayNum}
                          </span>
                        </div>

                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02),transparent_70%)]" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-full p-8 sm:p-10 border border-neutral-900/60 bg-black/20 rounded-sm opacity-30">
                      <div className="mb-6 flex items-center gap-3">
                        <span className="text-[9px] tracking-[0.3em] text-neutral-700 uppercase font-sans">
                          {t("commandment")}
                        </span>
                        <div className="h-px flex-1 bg-neutral-900" />
                        <span className="text-xs font-mono text-neutral-700">
                          {toRoman(dayNum)}
                        </span>
                      </div>
                      <p className="text-base font-serif text-neutral-700 italic">
                        {t("yetToBeWritten")}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#080808] border border-neutral-700 rounded-sm shadow-2xl p-10 sm:p-16 relative"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-transparent to-neutral-700" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-t from-transparent to-neutral-700" />

              <div className="text-center flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] tracking-[0.4em] text-neutral-600 uppercase font-sans">
                    {t("commandment")} {toRoman(selected.dayNumber)}
                  </span>
                  <div className="w-12 h-px bg-neutral-800 mt-2" />
                </div>
                <p className="text-2xl sm:text-3xl font-serif text-neutral-100 leading-relaxed italic">
                  &quot;{language === "zh" && selected.textZh ? selected.textZh : selected.text}
                  &quot;
                </p>
                <div className="flex flex-col items-center gap-1 mt-4">
                  <div className="w-12 h-px bg-neutral-800 mb-2" />
                  <span className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase font-sans">
                    {language === "zh" && selected.topicZh ? selected.topicZh : selected.topic}
                  </span>
                  <span className="text-[9px] tracking-[0.15em] text-neutral-700 font-sans">
                    {t("day")} {selected.dayNumber} · {selected.date}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="absolute top-6 right-6 text-[9px] tracking-[0.2em] text-neutral-600 uppercase font-sans hover:text-neutral-300 transition-colors"
              >
                {t("close")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function toRoman(n: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ["X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }
  return result;
}
