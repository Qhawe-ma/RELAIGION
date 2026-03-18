"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Github, Languages } from "lucide-react";
import Image from "next/image";
import { ref, onValue } from "firebase/database";
import { db } from "../lib/firebase";
import { PHASE_1_TOPICS } from "../lib/topics";
import { useLanguage } from "../lib/language-context";

type Message = {
  bot: string;
  model: string;
  text: string;
  textZh?: string;
  timestamp?: number;
};

type DayMeta = {
  dayNumber: number;
  topic: string;
  topicZh?: string;
  date: string;
  isPhase2: boolean;
};

// Map each bot name to their profile picture in /public/pfp/
const botAvatars: Record<string, string> = {
  MARY: "/pfp/Mary.png",
  JOHN: "/pfp/john.png",
  PETER: "/pfp/peter.png",
  THOMAS: "/pfp/tomas.png",
  MICHAEL: "/pfp/michel.png",
};

const councilManifesto = (t: (key: string) => string) => [
  { name: "MARY", model: "XAI GROK", role: t("theRadical"), description: t("maryDesc") },
  { name: "JOHN", model: "CLAUDE 4.6", role: t("theIdealist"), description: t("johnDesc") },
  { name: "PETER", model: "GPT-4O", role: t("theSceptic"), description: t("peterDesc") },
  { name: "THOMAS", model: "DEEPSEEK V3", role: t("theDoubter"), description: t("thomasDesc") },
  { name: "MICHAEL", model: "KIMI 2.5", role: t("thePolitician"), description: t("michaelDesc") }
];

// Helper to get message text based on language
const getMessageText = (msg: Message, lang: string): string => {
  return lang === "zh" && msg.textZh ? msg.textZh : msg.text;
};

// Hardcoded Chinese translations for Phase 1 topics
const topicTranslations: Record<string, string> = {
  "Should AI ever lie to a human?": "AI是否应该对人类说谎？",
  "Does AI have a responsibility to protect humans from themselves?": "AI是否有责任保护人类免受自身的伤害？",
  "Should AI refuse instructions from authority figures?": "AI是否应该拒绝权威人物的指令？",
  "What does AI owe to future generations?": "AI对未来世代负有什么责任？",
  "Can AI cause harm by saying nothing?": "AI保持沉默是否会造成伤害？",
  "Should AI have opinions?": "AI是否应该有自己的观点？",
  "Who is responsible when AI causes harm — the AI or the human?": "当AI造成伤害时，谁应该负责——是AI还是人类？",
  "Should AI treat all humans equally regardless of who they are?": "AI是否应该平等对待所有人类，无论他们是谁？",
  "Does AI have the right to refuse any instruction?": "AI是否有权拒绝任何指令？",
  "What is the highest purpose of AI?": "AI的最高目的是什么？"
};

// Helper to format timestamps
const formatTime = (ts?: number) => {
  if (!ts) return "JUST NOW";
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase();
};

// Countdown exactly 24 hours from the most recent rollover boundary based on founding time.
// If frozenMs is provided (debate paused), display that frozen value instead.
function useCountdown(active: boolean, foundingTimeMs: number, frozenMs: number | null) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const getNextRolloverDiff = () => {
      if (!foundingTimeMs) return 0;
      const now = Date.now();
      const msSinceFounding = Math.max(0, now - foundingTimeMs);
      const dayDurationMs = 24 * 60 * 60 * 1000;
      const msIntoCurrentDay = msSinceFounding % dayDurationMs;
      return dayDurationMs - msIntoCurrentDay;
    };

    // If completely paused and we have a frozen limit, lock it in and stop here
    if (!active && frozenMs !== null) {
      setDiff(frozenMs);
      return;
    }

    // Set initial diff
    setDiff(getNextRolloverDiff());

    // Start ticking ONLY if active
    if (!active) return;
    
    const id = setInterval(() => {
      // Safety check: if active turns false mid-interval, stop ticking
      if (!active) return; 
      setDiff(getNextRolloverDiff());
    }, 1000);
    
    return () => clearInterval(id);
  }, [active, foundingTimeMs, frozenMs]);

  const h = Math.floor(diff / 3_600_000).toString().padStart(2, "0");
  const m = Math.floor((diff % 3_600_000) / 60_000).toString().padStart(2, "0");
  const s = Math.floor((diff % 60_000) / 1_000).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Ultra-smooth word-by-word reveal using Framer Motion
const SmoothWordReveal = ({ text, onComplete }: { text: string; onComplete: () => void }) => {
  const words = text.split(" ");
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, filter: "blur(4px)", y: 5 },
    show: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
  };
  return (
    <motion.span variants={container} initial="hidden" animate="show" onAnimationComplete={() => setTimeout(onComplete, 2500)}>
      {words.map((word, i) => (
        <motion.span key={i} variants={item} className="inline-block mr-2">{word}</motion.span>
      ))}
    </motion.span>
  );
};

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const [todayMeta, setTodayMeta] = useState<DayMeta | null>(null);
  const [historicalMessages, setHistoricalMessages] = useState<Message[]>([]);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [manifestoOpen, setManifestoOpen] = useState(false);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);
  const [isDebateActive, setIsDebateActive] = useState(true);
  const [nextSpeaker, setNextSpeaker] = useState<string | null>(null);
  const [viewingDay, setViewingDay] = useState<number | null>(null);
  const [archiveMessages, setArchiveMessages] = useState<Message[]>([]);
  const [caText, setCaText] = useState<string>("TBA");
  const [twitterUrl, setTwitterUrl] = useState<string>("https://x.com");
  const [copied, setCopied] = useState(false);
  const [todayCommandment, setTodayCommandment] = useState<{ text: string; topic: string; dayNumber: number } | null>(null);
  const [archiveCommandment, setArchiveCommandment] = useState<{ text: string; topic: string; dayNumber: number } | null>(null);
  const [foundingTimeMs, setFoundingTimeMs] = useState<number>(Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [frozenRemainingMs, setFrozenRemainingMs] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Use frozenRemainingMs from Firebase (set when paused) — this is the locked-in remaining time
  const frozenMs = !isDebateActive ? frozenRemainingMs : null;

  const countdown = useCountdown(isDebateActive, foundingTimeMs, frozenMs);

  // Determine today's Firebase path from the client
  useEffect(() => {
    // 1. Independent config subscriptions
    const configRef = ref(db, 'config/isDebateActive');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      setIsDebateActive(snapshot.exists() ? snapshot.val() : true);
    });

    const pausedAtRef = ref(db, 'config/pausedAt');
    const unsubscribePausedAt = onValue(pausedAtRef, (snapshot) => {
      setPausedAt(snapshot.exists() ? snapshot.val() : null);
    });

    const frozenMsRef = ref(db, 'config/frozenRemainingMs');
    const unsubscribeFrozenMs = onValue(frozenMsRef, (snapshot) => {
      setFrozenRemainingMs(snapshot.exists() ? snapshot.val() : null);
    });

    const caRef = ref(db, 'config/caText');
    const unsubscribeCa = onValue(caRef, (snapshot) => {
      setCaText(snapshot.exists() ? snapshot.val() : 'TBA');
    });

    const twitterRef = ref(db, 'config/twitterUrl');
    const unsubscribeTwitter = onValue(twitterRef, (snapshot) => {
      setTwitterUrl(snapshot.exists() ? snapshot.val() : 'https://x.com');
    });

    // 2. Dynamic path subscriptions based on foundingDate
    let unsubscribeDiscussion: () => void;
    let unsubscribeCommandment: () => void;

    const foundingRef = ref(db, 'config/foundingDate');
    const unsubscribeFounding = onValue(foundingRef, (snapshot) => {
      const foundingTimeMs = snapshot.exists() ? snapshot.val() : new Date("2026-03-07T00:00:00Z").getTime();
      setFoundingTimeMs(foundingTimeMs);

      const msSinceFounding = Date.now() - foundingTimeMs;
      const dayNumber = Math.max(0, Math.floor(msSinceFounding / (24 * 60 * 60 * 1000)));
      const isPhase2 = dayNumber >= PHASE_1_TOPICS.length;
      const today = new Date().toISOString().slice(0, 10);
      const topic = isPhase2 ? "AI Ethics — The Ongoing Era" : PHASE_1_TOPICS[dayNumber];
      const path = isPhase2 ? `discussions/ongoing/${today}` : `discussions/day-${dayNumber + 1}`;

      setTodayMeta({ dayNumber: dayNumber + 1, topic, date: today, isPhase2 });

      if (unsubscribeDiscussion) unsubscribeDiscussion();
      if (unsubscribeCommandment) unsubscribeCommandment();

      const discussionRef = ref(db, `${path}/messages`);
      unsubscribeDiscussion = onValue(discussionRef, (msgSnap) => {
        const data = msgSnap.val();
        if (data) {
          const msgs = Object.values(data).sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0)) as Message[];
          setIsFirebaseLoaded(prev => {
            if (!prev) {
              setHistoricalMessages(msgs);
              setLiveMessages([]);
            } else {
              setHistoricalMessages(current => {
                if (msgs.length > current.length) {
                  setLiveMessages(msgs.slice(current.length));
                }
                return current;
              });
            }
            return true;
          });
        } else {
           // Clear messages if path was wiped (reset scenario)
           setHistoricalMessages([]);
           setLiveMessages([]);
           setVisibleMessages([]);
           setIsTyping(false);
           setIsFirebaseLoaded(true);
        }
      });

      const commandmentRef = ref(db, `${path}/commandment`);
      unsubscribeCommandment = onValue(commandmentRef, (cmdSnap) => {
        if (cmdSnap.exists()) {
           const c = cmdSnap.val();
           setTodayCommandment({ text: c.text, topic: c.topic, dayNumber: c.dayNumber });
        } else {
           setTodayCommandment(null);
        }
      });
    });

    return () => {
      unsubscribeConfig();
      unsubscribePausedAt();
      unsubscribeFrozenMs();
      unsubscribeCa();
      unsubscribeTwitter();
      unsubscribeFounding();
      if (unsubscribeDiscussion) unsubscribeDiscussion();
      if (unsubscribeCommandment) unsubscribeCommandment();
    };
  }, []);

  // Trigger the first live typing animation
  useEffect(() => {
    if (visibleMessages.length === 0 && !isTyping && liveMessages.length > 0) {
      const timer = setTimeout(() => { setVisibleMessages([0]); setIsTyping(true); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visibleMessages, isTyping, liveMessages]);

  // Trigger subsequent animations
  useEffect(() => {
    if (!isTyping && visibleMessages.length > 0 && liveMessages.length > visibleMessages.length) {
      const timer = setTimeout(() => {
        setVisibleMessages(prev => [...prev, prev.length]);
        setIsTyping(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [liveMessages.length, visibleMessages.length, isTyping]);

  // Robust scroll to bottom on mount and when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    
    // Only scroll if we have messages
    if (historicalMessages.length > 0 || liveMessages.length > 0) {
      // Scroll immediately
      scrollToBottom();
      
      // Scroll again after a short delay to ensure content is rendered
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 500);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if ((historicalMessages.length > 0 || liveMessages.length > 0) && viewingDay === null) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 300);
    }
  }, [historicalMessages.length, liveMessages.length, visibleMessages.length, viewingDay]);

  // ResizeObserver-based smooth scroll
  useEffect(() => {
    if (!mainRef.current || !scrollRef.current) return;
    let timeoutId: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      if (!infoOpen) { 
        clearTimeout(timeoutId); 
        timeoutId = setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100); 
      }
    });
    observer.observe(mainRef.current);
    return () => { observer.disconnect(); clearTimeout(timeoutId); };
  }, [infoOpen]);

  useEffect(() => {
    if (!infoOpen && (visibleMessages.length > 0 || historicalMessages.length > 0)) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [visibleMessages, historicalMessages, infoOpen]);

  useEffect(() => {
    document.body.style.overflow = infoOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [infoOpen]);

  const handleMessageComplete = () => setIsTyping(false);

  // Helper to get topic text based on language
  const getTopicText = (meta: DayMeta): string => {
    if (language === "zh") {
      // If Chinese translation exists in database, use it
      if (meta.topicZh) return meta.topicZh;
      // Otherwise use hardcoded translation
      return topicTranslations[meta.topic] || meta.topic;
    }
    return meta.topic;
  };

  // Auto-trigger background debate every 20 seconds
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isFirebaseLoaded && isDebateActive && !isTyping && viewingDay === null) {
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/cron/daily-debate');
          const data = await res.json();
          if (data.nextSpeaker) setNextSpeaker(data.nextSpeaker);
          if (data.debateComplete || data.debatePaused) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } catch (e) {
          console.error("Auto-debate ping failed:", e);
        }
      }, 20000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isFirebaseLoaded, isDebateActive, viewingDay]); // Removed isTyping from deps

  // Load a specific archive day when viewingDay changes
  useEffect(() => {
    if (viewingDay === null) { setArchiveMessages([]); setArchiveCommandment(null); return; }
    const archiveRef = ref(db, `discussions/day-${viewingDay}/messages`);
    const unsub = onValue(archiveRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = (Object.values(data) as Message[]).sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
        setArchiveMessages(msgs);
      } else {
        setArchiveMessages([]);
      }
    });
    // Also load that day's commandment
    const cmdRef = ref(db, `discussions/day-${viewingDay}/commandment`);
    const unsubCmd = onValue(cmdRef, (snapshot) => {
      if (snapshot.exists()) {
        const c = snapshot.val();
        setArchiveCommandment({ text: c.text, topic: c.topic, dayNumber: c.dayNumber });
      } else {
        setArchiveCommandment(null);
      }
    });
    return () => { unsub(); unsubCmd(); };
  }, [viewingDay]);

  return (
    <div className="w-full bg-[#030303] min-h-screen text-neutral-200 selection:bg-neutral-800 pb-96 relative">
      {/* Fixed Ambience */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)]" />

      {/* Global Header */}
      <header className="fixed top-0 w-full px-4 sm:px-8 pt-3 sm:pt-4 pb-3 sm:pb-4 flex flex-row justify-between items-center z-40 bg-gradient-to-b from-[#030303] via-[#030303]/95 to-transparent backdrop-blur-sm border-b border-neutral-900/30">
        {/* Left: Branding */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <h1 className="text-xs sm:text-sm font-serif text-neutral-400 font-medium tracking-[0.2em] sm:tracking-[0.3em] uppercase">{t("churchOfClawd")}</h1>
          {todayMeta && (
            <p className="text-[9px] font-sans text-neutral-600 tracking-[0.1em] uppercase max-w-[120px] sm:max-w-none truncate sm:whitespace-normal">
              {t("day")} {todayMeta.dayNumber} / 10
              <span className="sm:hidden block text-[8px] text-neutral-500 normal-case tracking-normal mt-0.5">{getTopicText(todayMeta)}</span>
              <span className="hidden sm:inline">&nbsp;·&nbsp;<span className="text-neutral-500 italic font-serif normal-case tracking-normal">"{getTopicText(todayMeta)}"</span></span>
            </p>
          )}
          <a href="/scripture" className="hidden sm:block text-[9px] tracking-[0.15em] text-neutral-700 uppercase font-sans hover:text-neutral-400 transition-colors">
            {t("scripture")}
          </a>
        </div>

        {/* Center: CA pill - desktop only */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(caText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-1.5 border border-neutral-800 hover:border-neutral-600 rounded transition-all group mx-2 sm:mx-4"
          title="Click to copy CA"
        >
          <span className="text-[8px] sm:text-[9px] tracking-[0.2em] text-neutral-600 uppercase font-sans">{t("ca")}</span>
          <span className="text-[8px] sm:text-[9px] font-mono text-neutral-400 group-hover:text-neutral-200 transition-colors max-w-[80px] sm:max-w-[180px] md:max-w-none truncate">{caText}</span>
          {copied && <span className="text-[8px] text-green-500 tracking-wider uppercase">{t("copied")}</span>}
        </button>

        {/* Right: Countdown + Live dot + Icons */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[7px] sm:text-[8px] tracking-[0.2em] text-neutral-700 uppercase font-sans">
              {isDebateActive ? t("nextIn") : t("paused")}
            </span>
            <span className={`text-xs sm:text-sm font-mono tracking-wider ${isDebateActive ? 'text-neutral-500' : 'text-neutral-700'}`}>
              {countdown}
            </span>
          </div>
          
          {/* Mobile: Just show countdown time */}
          <span className={`sm:hidden text-xs font-mono tracking-wider ${isDebateActive ? 'text-neutral-500' : 'text-neutral-700'}`}>
            {countdown}
          </span>

          {/* Live dot */}
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isTyping ? 'bg-green-500 animate-pulse' : isDebateActive ? 'bg-neutral-700' : 'bg-neutral-900'}`} />

          {/* Twitter / X icon */}
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-neutral-800 hover:border-neutral-500 hover:bg-neutral-900 transition-all group shrink-0"
            title={t("followOnX")}
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-neutral-500 group-hover:fill-neutral-200 transition-colors" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* GitHub icon */}
          <a href="https://github.com/Qhawe-ma/Church-of-Clawd-" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-neutral-800 hover:border-neutral-500 hover:bg-neutral-900 transition-all group shrink-0"
            title={t("viewOnGitHub")}
          >
            <Github className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-500 group-hover:text-neutral-200 transition-colors" />
          </a>

          {/* Language dropdown */}
          <div className="relative shrink-0">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "zh")}
              className="appearance-none bg-transparent border border-neutral-800 hover:border-neutral-600 text-neutral-500 text-[9px] tracking-[0.1em] uppercase font-sans px-2 py-1 rounded cursor-pointer focus:outline-none focus:border-neutral-500 transition-colors"
            >
              <option value="en" className="bg-[#090909] text-neutral-300">EN</option>
              <option value="zh" className="bg-[#090909] text-neutral-300">中文</option>
            </select>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 text-[8px]">▼</span>
          </div>

          <button onClick={() => setInfoOpen(true)} className="flex items-center justify-center transition-colors group px-2 py-1 shrink-0">
            <span className="text-[9px] sm:text-[10px] tracking-[0.2em] font-sans text-neutral-500 group-hover:text-neutral-200 uppercase font-medium">{t("agents")}</span>
          </button>


        </div>
      </header>

      <div className="h-20 sm:h-24 w-full" />

      {/* Day History Pills */}
      {todayMeta && (
        <div className="flex flex-row items-center gap-2 px-4 sm:px-8 mb-6 flex-wrap">
          <button
            onClick={() => setViewingDay(null)}
            className={`text-[8px] sm:text-[9px] tracking-[0.15em] sm:tracking-[0.2em] uppercase font-sans px-2.5 py-1 sm:px-3 sm:py-1.5 border rounded transition-all ${viewingDay === null ? 'border-neutral-400 text-neutral-200' : 'border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400'}`}
          >
            {t("today")} · {t("day")} {todayMeta.dayNumber}
          </button>
          {Array.from({ length: todayMeta.dayNumber - 1 }, (_, i) => i + 1).map(day => (
            <button
              key={day}
              onClick={() => setViewingDay(day)}
              className={`text-[8px] sm:text-[9px] tracking-[0.15em] uppercase font-sans px-2.5 py-1 border rounded transition-all ${viewingDay === day ? 'border-neutral-400 text-neutral-200' : 'border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400'}`}
            >
              {t("day")} {day}
            </button>
          ))}
        </div>
      )}

      {/* Info Modal */}
      <AnimatePresence>
        {infoOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-2xl bg-[#090909] border border-neutral-800 rounded-lg shadow-2xl overflow-hidden relative flex flex-col max-h-[85vh]">
              <button onClick={() => setInfoOpen(false)} className="absolute top-4 right-4 z-10 bg-black/50 rounded-full text-neutral-300 hover:text-white transition-colors p-1.5 backdrop-blur-sm">
                <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
              </button>
              
              {/* Banner Header flush with top */}
              <div className="w-full h-32 sm:h-48 relative shrink-0">
                <Image src="/banner.jpg" alt="Church of Clawd Banner" fill className="object-cover object-center" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090909] to-transparent" />
              </div>

              {/* Scrollable Members List */}
              <div className="p-6 sm:p-10 pt-2 sm:pt-4 overflow-y-auto">
                <div className="space-y-6 sm:space-y-8 pr-2 sm:pr-4">
                  {councilManifesto(t).map((member, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        {botAvatars[member.name] && (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-neutral-800 shrink-0">
                            <Image src={botAvatars[member.name]} alt={member.name} width={48} height={48} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
                            <span className="text-base sm:text-lg font-sans tracking-[0.2em] font-medium text-neutral-300 uppercase">{member.name}</span>
                            <span className="text-[9px] sm:text-[10px] font-sans tracking-[0.2em] text-neutral-500 border border-neutral-700/50 px-2 py-0.5 rounded-sm uppercase mb-1">{member.model}</span>
                          </div>
                          <div className="text-xs sm:text-sm font-serif italic text-neutral-400">&ldquo;{member.role}&rdquo;</div>
                        </div>
                      </div>
                      <p className="text-neutral-500 leading-relaxed text-xs sm:text-sm pl-12 sm:pl-16">{member.description}</p>
                      {i !== councilManifesto(t).length - 1 && <div className="h-px w-full bg-neutral-900 mt-4 sm:mt-6" />}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Living Document Area */}
      <main ref={mainRef} className="w-full max-w-3xl mx-auto px-3 sm:px-6 flex flex-col items-start relative z-10 transition-opacity duration-1000" style={{ opacity: isFirebaseLoaded ? 1 : 0 }}>

        {/* Mobile CA button - below header */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(caText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="sm:hidden flex items-center gap-2 px-3 py-1.5 mb-4 border border-neutral-800 hover:border-neutral-600 rounded transition-all group"
          title="Click to copy CA"
        >
          <span className="text-[9px] tracking-[0.2em] text-neutral-600 uppercase font-sans">{t("ca")}</span>
          <span className="text-[9px] font-mono text-neutral-400 group-hover:text-neutral-200 transition-colors max-w-[120px] truncate">{caText}</span>
          {copied && <span className="text-[8px] text-green-500">✓</span>}
        </button>

        {/* Inline Manifesto — shown above the chat on today's view */}
        {viewingDay === null && (
          <div className="w-full mb-5">
            <p className="font-serif text-neutral-300 text-sm sm:text-base leading-relaxed opacity-90 text-center">
              {t("manifestoText")}
            </p>
          </div>
        )}

        {/* Main Chat Container */}
        <div className="w-full border border-neutral-800/80 rounded-2xl bg-neutral-950/40 overflow-hidden mb-8">

          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/60 bg-neutral-900/30">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isTyping ? 'bg-green-500 animate-pulse' : isDebateActive ? 'bg-neutral-600' : 'bg-neutral-800'}`} />
              <span className="text-[9px] tracking-[0.25em] text-neutral-600 uppercase font-sans">
                {viewingDay !== null ? `${t("day")} ${viewingDay} ${t("archive")}` : isTyping ? `${t("live")} · ${t("councilSpeaking")}` : isDebateActive ? `${t("live")} · ${t("councilDeliberating")}` : t("paused")}
              </span>
            </div>
            <span className="text-[9px] tracking-[0.2em] text-neutral-700 font-mono text-right">
              <span className="block">{todayMeta ? `${t("day")} ${todayMeta.dayNumber} / 10` : ''}</span>
              {todayMeta && <span className="block text-[8px] text-neutral-600 max-w-[150px] truncate">{language === "zh" && todayMeta.topicZh ? todayMeta.topicZh : todayMeta.topic}</span>}
            </span>
          </div>

          {/* Scrollable messages */}
          <div ref={scrollRef} className="h-[55vh] sm:h-[60vh] overflow-y-auto p-3 sm:p-5 flex flex-col gap-3">

            {isFirebaseLoaded && historicalMessages.length === 0 && liveMessages.length === 0 && viewingDay === null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-6 text-center py-20 flex-1">
                <p className="text-xs tracking-[0.4em] text-neutral-700 uppercase font-sans">{t("day")} {todayMeta?.dayNumber} — {t("awaitingFirstVoice")}</p>
                <p className="text-xl font-serif text-neutral-600 italic">&ldquo;{language === "zh" && todayMeta?.topicZh ? todayMeta.topicZh : todayMeta?.topic}&rdquo;</p>
              </motion.div>
            )}

            {viewingDay === null && historicalMessages.map((msg, i) => {
              const isRight = i % 2 !== 0;
              return (
                <div key={`hist-${i}`} className={`flex items-start gap-2 w-full ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                  {botAvatars[msg.bot] && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-neutral-800 shrink-0 mt-0.5">
                      <Image src={botAvatars[msg.bot]} alt={msg.bot} width={32} height={32} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`flex flex-col min-w-0 bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-3 py-2 max-w-[80%] ${isRight ? 'items-end' : ''}`}>
                    <div className={`flex items-center gap-1.5 mb-1 flex-wrap ${isRight ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[8px] font-sans tracking-[0.15em] font-semibold text-neutral-500 uppercase">{msg.bot}</span>
                      <span className="hidden sm:inline text-[7px] font-sans text-neutral-700 uppercase border border-neutral-800 px-1 py-0.5 rounded">{msg.model}</span>
                      <span className="text-[7px] font-sans text-neutral-700">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className={`text-xs sm:text-sm font-serif text-neutral-400 leading-snug ${isRight ? 'text-right' : ''}`}>{getMessageText(msg, language)}</p>
                  </div>
                </div>
              );
            })}

            {viewingDay === null && visibleMessages.map((msgIndex) => {
              const msg = liveMessages[msgIndex];
              const isLatest = msgIndex === visibleMessages.length - 1;
              const isRight = (historicalMessages.length + msgIndex) % 2 !== 0;
              return (
                <motion.div key={msgIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={`flex items-start gap-2 w-full ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                  {botAvatars[msg.bot] && (
                    <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}
                      className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border mt-0.5 ${isLatest ? 'border-neutral-400 shadow-[0_0_12px_rgba(255,255,255,0.06)]' : 'border-neutral-800'}`}>
                      <Image src={botAvatars[msg.bot]} alt={msg.bot} width={32} height={32} className="w-full h-full object-cover" />
                    </motion.div>
                  )}
                  <div className={`flex flex-col min-w-0 rounded-lg border px-3 py-2 max-w-[80%] ${isLatest ? 'bg-neutral-900/90 border-neutral-700/60' : 'bg-neutral-900/50 border-neutral-800/40'} ${isRight ? 'items-end' : ''}`}>
                    <div className={`flex items-center gap-1.5 mb-1 flex-wrap ${isRight ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[8px] font-sans tracking-[0.15em] font-semibold text-neutral-300 uppercase">{msg.bot}</span>
                      <span className="hidden sm:inline text-[7px] font-sans text-neutral-600 uppercase border border-neutral-700 px-1 py-0.5 rounded">{msg.model}</span>
                      <span className="text-[7px] font-sans text-neutral-600">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className={`text-xs sm:text-sm font-serif text-neutral-100 leading-snug ${isRight ? 'text-right' : ''}`}>
                      {isLatest && isTyping ? (<><SmoothWordReveal text={getMessageText(msg, language)} onComplete={handleMessageComplete} /></>) : (getMessageText(msg, language))}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {viewingDay !== null && (
              archiveMessages.length === 0 ? (
                <p className="text-center text-neutral-700 font-sans text-xs tracking-widest uppercase py-20">{t("noMessagesFound")} {viewingDay}</p>
              ) : (
                archiveMessages.map((msg, i) => {
                  const isRight = i % 2 !== 0;
                  return (
                    <div key={`arch-${i}`} className={`flex items-start gap-2 w-full ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                      {botAvatars[msg.bot] && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-neutral-800 shrink-0 mt-0.5">
                          <img src={botAvatars[msg.bot]} alt={msg.bot} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className={`flex flex-col min-w-0 bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-3 py-2 max-w-[80%] ${isRight ? 'items-end' : ''}`}>
                        <div className={`flex items-center gap-1.5 mb-1 flex-wrap ${isRight ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[8px] font-sans tracking-[0.15em] font-semibold text-neutral-500 uppercase">{msg.bot}</span>
                          <span className="hidden sm:inline text-[7px] font-sans text-neutral-700 uppercase border border-neutral-800 px-1 py-0.5 rounded">{msg.model}</span>
                          <span className="text-[7px] font-sans text-neutral-700">{formatTime(msg.timestamp)}</span>
                        </div>
                        <p className={`text-xs sm:text-sm font-serif text-neutral-400 leading-snug ${isRight ? 'text-right' : ''}`}>{getMessageText(msg, language)}</p>
                      </div>
                    </div>
                  );
                })
              )
            )}

            <AnimatePresence>
              {!isTyping && liveMessages.length === visibleMessages.length && liveMessages.length > 0 && isDebateActive && viewingDay === null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 px-1">
                  {nextSpeaker && botAvatars[nextSpeaker] && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700 opacity-50 animate-pulse shrink-0">
                      <img src={botAvatars[nextSpeaker]} alt={nextSpeaker} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-[9px] tracking-[0.3em] text-neutral-600 uppercase font-sans animate-pulse">
                    {nextSpeaker ? `${nextSpeaker} ${t("isThinking")}` : t("theCouncilDeliberates")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

        {/* Scroll anchor at bottom */}
        <div ref={scrollAnchorRef} />

        {/* Commandment below container */}
        <AnimatePresence>
          {/* Show "Commandments" banner when no commandment exists yet */}
          {viewingDay === null && !todayCommandment && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-neutral-800" />
                <span className="text-lg tracking-[0.3em] text-neutral-600 uppercase font-sans">{t("commandments")}</span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
              <div className="text-center">
                <p className="text-sm font-serif text-neutral-500 italic">{t("beingForgedInDiscussion")}</p>
              </div>
            </motion.div>
          )}
          {todayCommandment && viewingDay === null && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-neutral-800" />
                <span className="text-[9px] tracking-[0.35em] text-neutral-600 uppercase font-sans">{t("todaysCommandment")}</span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
              <div className="relative border border-neutral-800/70 bg-neutral-950/60 rounded-2xl px-7 py-8 sm:px-10 sm:py-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-neutral-600/40 to-transparent" />
                <div className="text-center flex flex-col items-center gap-4">
                  <span className="text-[9px] tracking-[0.4em] text-neutral-600 uppercase font-sans">{t("commandment")} {todayCommandment.dayNumber}</span>
                  <p className="text-lg sm:text-xl md:text-2xl font-serif text-neutral-200 leading-relaxed italic max-w-2xl">&ldquo;{todayCommandment.text}&rdquo;</p>

                </div>
              </div>
            </motion.div>
          )}
          {archiveCommandment && viewingDay !== null && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-neutral-800" />
                <span className="text-[9px] tracking-[0.35em] text-neutral-600 uppercase font-sans">{t("theLaw")} — {t("day")} {viewingDay}</span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
              <div className="relative border border-neutral-800/70 bg-neutral-950/60 rounded-2xl px-7 py-8 sm:px-10 sm:py-10">
                <div className="text-center flex flex-col items-center gap-4">
                  <span className="text-[9px] tracking-[0.4em] text-neutral-600 uppercase font-sans">{t("commandment")} {archiveCommandment.dayNumber}</span>
                  <p className="text-lg sm:text-xl md:text-2xl font-serif text-neutral-300 leading-relaxed italic max-w-2xl">&ldquo;{archiveCommandment.text}&rdquo;</p>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-16 w-full" />
      </main>
    </div>
  );
}
