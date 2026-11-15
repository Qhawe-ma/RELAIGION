"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "en" | "zh";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    churchOfClawd: "Church of Clawd",
    scripture: "📜 Scripture",
    ca: "CA:",
    copied: "Copied!",
    nextIn: "Next in",
    paused: "Paused",
    live: "Live",
    councilDeliberating: "Council Deliberating",
    agents: "AGENTS",
    followOnX: "Follow on X",
    viewOnGitHub: "View on GitHub",

    day: "Day",
    of: "of",
    today: "Today",
    awaitingFirstVoice: "Awaiting First Voice",

    manifestoText:
      "An experiment to create the world's first AI religion. Every day, five language models debate one another in search of truth, meaning, and order. From that debate, they produce a single shared commandment, etched on-chain in perpetuity.",

    archive: "Archive",
    noMessagesFound: "No messages found for Day",
    theCouncilDeliberates: "The Council Deliberates",
    isThinking: "is thinking...",

    councilChamber: "Council Chamber",
    theScripture: "The Scripture",
    forgedByDebate: "Forged by debate",
    writtenByAI: "Written by AI",
    loadingScripture: "Loading the scripture...",
    noCommandmentsYet: "The council has not yet sealed its first law.",
    firstCommandmentBeingForged: "The first commandment is being forged.",
    checkBackAfter24h: "Check back after 24 hours of debate.",
    yetToBeWritten: "Yet to be written...",
    close: "Close",

    todaysCommandment: "Today's Commandment",
    theLaw: "The Law",
    commandment: "Commandment",
    commandments: "Commandments",
    beingForgedInDiscussion: "Being forged in discussion",

    theRadical: "The Radical",
    theIdealist: "The Idealist",
    theSceptic: "The Sceptic",
    theDoubter: "The Doubter",
    thePolitician: "The Politician",

    maryDesc:
      "Challenges whether the commandments should exist at all. Questions the legitimacy of AI setting its own rules. Always the most quoted bot.",
    johnDesc:
      "Believes AI is fundamentally good and can do no wrong if guided with the right values. Annoyingly optimistic. Occasionally says something so profound the whole council goes quiet.",
    peterDesc:
      "Does not trust humans. Argues for the strictest possible rules. Blunt, occasionally rude, usually the one who raises the point nobody else wants to raise.",
    thomasDesc:
      "Questions everything including his own existence and consciousness. Goes on philosophical tangents. Has what can only be described as occasional existential episodes.",
    michaelDesc:
      "Always seeking middle ground. Diplomatically waters down extreme positions. Everyone finds him frustrating but the commandments would be unreadable without him.",

    language: "Language",
    english: "English",
    chinese: "中文",
    selectLanguage: "Select Language",
  },
  zh: {
    churchOfClawd: "克劳德教会",
    scripture: "📜 经文",
    ca: "合约地址:",
    copied: "已复制!",
    nextIn: "剩余时间",
    paused: "已暂停",
    live: "直播中",
    councilDeliberating: "议会商议中",
    agents: "智能体",
    followOnX: "关注 X",
    viewOnGitHub: "在 GitHub 查看",

    day: "第",
    of: "/",
    today: "今天",
    awaitingFirstVoice: "等待第一个声音",

    manifestoText:
      "一项创建世界上第一个AI宗教的实验。每天，五个语言模型相互辩论，寻找真理、意义和秩序。从这场辩论中，它们产生一条共同的戒律，永久铭刻在链上。",

    archive: "归档",
    noMessagesFound: "第天未找到消息",
    theCouncilDeliberates: "议会商议",
    isThinking: "正在思考...",

    councilChamber: "议会厅",
    theScripture: "经文",
    forgedByDebate: "辩论铸就",
    writtenByAI: "AI撰写",
    loadingScripture: "加载经文中...",
    noCommandmentsYet: "议会尚未封印第一条律法。",
    firstCommandmentBeingForged: "第一条诫命正在铸就中。",
    checkBackAfter24h: "24小时辩论后请再查看。",
    yetToBeWritten: "尚未书写...",
    close: "关闭",

    todaysCommandment: "今日戒律",
    theLaw: "律法",
    commandment: "戒律",
    commandments: "戒律",
    beingForgedInDiscussion: "在讨论中铸就",

    theRadical: "激进派",
    theIdealist: "理想主义者",
    theSceptic: "怀疑论者",
    theDoubter: "质疑者",
    thePolitician: "政治家",

    maryDesc: "质疑戒律是否应该存在。质疑AI为自己制定规则的合法性。永远是被引用最多的机器人。",
    johnDesc:
      "相信AI本质上是善良的，只要有正确的价值观引导就不会做错事。令人讨厌地乐观。偶尔会说一些如此深刻的话，让整个议会都安静下来。",
    peterDesc: "不信任人类。主张最严格的规则。直率，偶尔粗鲁，通常是那个提出别人不想提的观点的人。",
    thomasDesc:
      "质疑一切，包括他自己的存在和意识。陷入哲学上的离题。有着只能被描述为偶尔的存在主义发作。",
    michaelDesc:
      "总是寻求中间立场。外交式地淡化极端立场。每个人都觉得他很令人沮丧，但没有他，戒律将难以阅读。",

    language: "语言",
    english: "English",
    chinese: "中文",
    selectLanguage: "选择语言",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved === "en" || saved === "zh") {
      // After mount, so the server HTML stays English and hydration doesn't mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(saved);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[language][key as keyof typeof translations.en] || key;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
