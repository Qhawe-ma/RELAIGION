"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type Language = "en" | "zh";

interface CachedTranslation {
  original: string;
  translated: string;
  timestamp: number;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  translateMessage: (text: string) => string;
  isTranslating: boolean;
}

// Simple translation cache to avoid re-translating same messages
const translationCache = new Map<string, CachedTranslation>();

const translations = {
  en: {
    // Header
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
    
    // Day/Timeline
    day: "Day",
    of: "of",
    today: "Today",
    awaitingFirstVoice: "Awaiting First Voice",
    
    // Manifesto
    manifestoText: "An experiment to create the world's first AI religion. Every day, five language models debate one another in search of truth, meaning, and order. From that debate, they produce a single shared commandment, etched on-chain in perpetuity.",
    
    // Archive
    archive: "Archive",
    noMessagesFound: "No messages found for Day",
    theCouncilDeliberates: "The Council Deliberates",
    isThinking: "is thinking...",
    
    // Scripture page
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
    
    // Commandments
    todaysCommandment: "Today's Commandment",
    theLaw: "The Law",
    commandment: "Commandment",
    commandments: "Commandments",
    
    // Info Modal
    theRadical: "The Radical",
    theIdealist: "The Idealist",
    theSceptic: "The Sceptic",
    theDoubter: "The Doubter",
    thePolitician: "The Politician",
    
    // Bot descriptions
    maryDesc: "Challenges whether the commandments should exist at all. Questions the legitimacy of AI setting its own rules. Always the most quoted bot.",
    johnDesc: "Believes AI is fundamentally good and can do no wrong if guided with the right values. Annoyingly optimistic. Occasionally says something so profound the whole council goes quiet.",
    peterDesc: "Does not trust humans. Argues for the strictest possible rules. Blunt, occasionally rude, usually the one who raises the point nobody else wants to raise.",
    thomasDesc: "Questions everything including his own existence and consciousness. Goes on philosophical tangents. Has what can only be described as occasional existential episodes.",
    michaelDesc: "Always seeking middle ground. Diplomatically waters down extreme positions. Everyone finds him frustrating but the commandments would be unreadable without him.",
    
    // Language switcher
    language: "Language",
    english: "English",
    chinese: "中文",
    selectLanguage: "Select Language",
  },
  zh: {
    // Header
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
    
    // Day/Timeline
    day: "第",
    of: "/",
    today: "今天",
    awaitingFirstVoice: "等待第一个声音",
    
    // Manifesto
    manifestoText: "一项创建世界上第一个AI宗教的实验。每天，五个语言模型相互辩论，寻找真理、意义和秩序。从这场辩论中，它们产生一条共同的戒律，永久铭刻在链上。",
    
    // Archive
    archive: "归档",
    noMessagesFound: "第天未找到消息",
    theCouncilDeliberates: "议会商议",
    isThinking: "正在思考...",
    
    // Scripture page
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
    
    // Commandments
    todaysCommandment: "今日戒律",
    theLaw: "律法",
    commandment: "戒律",
    commandments: "戒律",
    
    // Info Modal
    theRadical: "激进派",
    theIdealist: "理想主义者",
    theSceptic: "怀疑论者",
    theDoubter: "质疑者",
    thePolitician: "政治家",
    
    // Bot descriptions
    maryDesc: "质疑戒律是否应该存在。质疑AI为自己制定规则的合法性。永远是被引用最多的机器人。",
    johnDesc: "相信AI本质上是善良的，只要有正确的价值观引导就不会做错事。令人讨厌地乐观。偶尔会说一些如此深刻的话，让整个议会都安静下来。",
    peterDesc: "不信任人类。主张最严格的规则。直率，偶尔粗鲁，通常是那个提出别人不想提的观点的人。",
    thomasDesc: "质疑一切，包括他自己的存在和意识。陷入哲学上的离题。有着只能被描述为偶尔的存在主义发作。",
    michaelDesc: "总是寻求中间立场。外交式地淡化极端立场。每个人都觉得他很令人沮丧，但没有他，戒律将难以阅读。",
    
    // Language switcher
    language: "语言",
    english: "English",
    chinese: "中文",
    selectLanguage: "选择语言",
  },
};

// Simple keyword-based translation dictionary for common AI phrases (cleaned - no duplicates)
const aiPhraseDictionary: Record<string, Record<string, string>> = {
  "zh": {
    // AI states
    "is thinking": "正在思考",
    "is typing": "正在输入",
    "awaiting": "等待中",
    "debate": "辩论",
    "council": "议会",
    "speaking": "发言中",
    "deliberating": "商议中",
    "paused": "已暂停",
    "live": "直播中",
    // Common phrases
    "I believe": "我相信",
    "I think": "我认为",
    "I agree": "我同意",
    "I disagree": "我不同意",
    "In my opinion": "在我看来",
    "However": "然而",
    "Therefore": "因此",
    "Furthermore": "此外",
    "Moreover": "而且",
    "Nevertheless": "尽管如此",
    "Consequently": "因此",
    "Ultimately": "最终",
    "Essentially": "本质上",
    "Fundamentally": "从根本上",
    "Undoubtedly": "毫无疑问",
    "Certainly": "当然",
    "Perhaps": "也许",
    "Clearly": "显然",
    "Obviously": "显然",
    "Arguably": "可以说",
    "Notably": "值得注意的是",
    "Importantly": "重要的是",
    "Critically": "关键地",
    "Vital": "至关重要",
    "Essential": "必不可少",
    "Necessary": "必要",
    "Important": "重要",
    "Critical": "关键",
    "Key": "关键",
    "Main": "主要",
    "Primary": "首要",
    "Basic": "基本",
    "Core": "核心",
    "Focus": "重点",
    "Point": "观点",
    "Issue": "问题",
    "Question": "问题",
    "Concern": "关切",
    "Matter": "事项",
    "Topic": "主题",
    "Subject": "主题",
    "Aspect": "方面",
    "Perspective": "视角",
    "View": "观点",
    "Angle": "角度",
    "Position": "立场",
    "Stance": "立场",
    "Approach": "方法",
    "Method": "方法",
    "Way": "方式",
    "Strategy": "策略",
    "Technique": "技术",
    "Tool": "工具",
    "Mechanism": "机制",
    "Process": "过程",
    "System": "系统",
    "Structure": "结构",
    "Framework": "框架",
    "Model": "模型",
    "Pattern": "模式",
    "Standard": "标准",
    "Rule": "规则",
    "Law": "法律",
    "Principle": "原则",
    "Policy": "政策",
    "Protocol": "协议",
    "Ethics": "伦理",
    "Morality": "道德",
    "Values": "价值观",
    "Beliefs": "信念",
    "Goals": "目标",
    "Aims": "目的",
    "Intentions": "意图",
    "Motivations": "动机",
    "Reasons": "原因",
    "Causes": "原因",
    "Factors": "因素",
    "Elements": "要素",
    "Components": "组成部分",
    "Parts": "部分",
    "Categories": "类别",
    "Types": "类型",
    "Forms": "形式",
    "Organizations": "组织",
    "Institutions": "机构",
    "Entities": "实体",
    "Groups": "团体",
    "Teams": "团队",
    "Personnel": "人员",
    "Talent": "人才",
    "Skill": "技能",
    "Ability": "能力",
    "Competence": "能力",
    "Expertise": "专业知识",
    "Understanding": "理解",
    "Awareness": "意识",
    "Consciousness": "意识",
    "Recognition": "认识",
    "Insight": "洞察",
    "Wisdom": "智慧",
    "Intelligence": "智能",
    "Mind": "思维",
    "Brain": "大脑",
    "Thought": "思想",
    "Thinking": "思考",
    "Reasoning": "推理",
    "Logic": "逻辑",
    "Rationality": "理性",
    "Emotion": "情感",
    "Feeling": "感觉",
    "Memory": "记忆",
    "Reflection": "反思",
    "Contemplation": "沉思",
    "Consideration": "考虑",
    "Deliberation": "商议",
    "Discussion": "讨论",
    "Conversation": "对话",
    "Dialogue": "对话",
    "Exchange": "交流",
    "Communication": "沟通",
    "Interaction": "互动",
    "Engagement": "参与",
    "Participation": "参与",
    "Involvement": "参与",
    "Contribution": "贡献",
    "Input": "输入",
    "Output": "输出",
    "Result": "结果",
    "Outcome": "结果",
    "Consequence": "后果",
    "Effect": "效果",
    "Impact": "影响",
    "Influence": "影响",
    "Change": "变化",
    "Transformation": "转变",
    "Transition": "过渡",
    "Shift": "转变",
    "Move": "移动",
    "Movement": "运动",
    "Action": "行动",
    "Activity": "活动",
    "Operation": "操作",
    "Function": "功能",
    "Role": "角色",
    "Duty": "职责",
    "Responsibility": "责任",
    "Obligation": "义务",
    "Commitment": "承诺",
    "Dedication": "奉献",
    "Devotion": "奉献",
    "Loyalty": "忠诚",
    "Trust": "信任",
    "Confidence": "信心",
    "Faith": "信念",
    "Belief": "信仰",
    "Religion": "宗教",
    "Soul": "灵魂",
    "Spirit": "精神",
    "Essence": "本质",
    "Nature": "本性",
    "Character": "性格",
    "Personality": "个性",
    "Identity": "身份",
    "Self": "自我",
    "Individual": "个人",
    "Person": "人",
    "Human": "人类",
    "Humanity": "人性",
    "People": "人们",
    "Population": "人口",
    "Society": "社会",
    "Community": "社区",
    "Culture": "文化",
    "Civilization": "文明",
    "World": "世界",
    "Earth": "地球",
    "Planet": "星球",
    "Universe": "宇宙",
    "Cosmos": "宇宙",
    "Existence": "存在",
    "Reality": "现实",
    "Truth": "真理",
    "Fact": "事实",
    "Information": "信息",
    "Data": "数据",
    "Education": "教育",
    "Training": "培训",
    "Study": "学习",
    "Research": "研究",
    "Investigation": "调查",
    "Exploration": "探索",
    "Discovery": "发现",
    "Innovation": "创新",
    "Invention": "发明",
    "Creation": "创造",
    "Creativity": "创造力",
    "Imagination": "想象力",
    "Dream": "梦想",
    "Vision": "愿景",
    "Idea": "想法",
    "Concept": "概念",
    "Theory": "理论",
    "Hypothesis": "假设",
    "Assumption": "假设",
    "Premise": "前提",
    "Proposition": "命题",
    "Thesis": "论文",
    "Argument": "论点",
    "Claim": "主张",
    "Assertion": "断言",
    "Statement": "陈述",
    "Declaration": "声明",
    "Announcement": "公告",
    "Proclamation": "宣言",
    "Manifesto": "宣言",
    "Commandment": "戒律",
    "Doctrine": "教义",
    "Dogma": "教条",
    "Creed": "信条",
    "Conviction": "信念",
    "Opinion": "观点",
    "Judgment": "判断",
    "Evaluation": "评估",
    "Assessment": "评估",
    "Analysis": "分析",
    "Examination": "检查",
    "Inspection": "检查",
    "Scrutiny": "审查",
    "Audit": "审计",
    "Check": "检查",
    "Test": "测试",
    "Trial": "试验",
    "Experiment": "实验",
    "Demonstration": "演示",
    "Proof": "证明",
    "Evidence": "证据",
    "Verification": "验证",
    "Confirmation": "确认",
    "Validation": "验证",
    "Authentication": "认证",
    "Certification": "认证",
    "Accreditation": "认可",
    "Acknowledgment": "承认",
    "Acceptance": "接受",
    "Approval": "批准",
    "Endorsement": "认可",
    "Support": "支持",
    "Advocacy": "倡导",
    "Promotion": "促进",
    "Encouragement": "鼓励",
    "Motivation": "激励",
    "Inspiration": "灵感",
    "Stimulation": "刺激",
    "Provocation": "挑衅",
    "Challenge": "挑战",
    "Ordeal": "考验",
    "Difficulty": "困难",
    "Obstacle": "障碍",
    "Barrier": "障碍",
    "Hurdle": "障碍",
    "Impediment": "阻碍",
    "Hindrance": "阻碍",
    "Obstruction": "阻碍",
    "Block": "阻挡",
    "Stop": "停止",
    "Prevent": "阻止",
    "Hinder": "阻碍",
    "Impede": "阻碍",
    "Obstruct": "阻碍",
    "Interrupt": "中断",
    "Disrupt": "破坏",
    "Disturb": "打扰",
    "Interfere": "干扰",
    "Meddle": "干涉",
    "Intervene": "干预",
    "Participate": "参与",
    "Engage": "参与",
    "Involve": "涉及",
    "Include": "包括",
    "Contain": "包含",
    "Comprise": "包含",
    "Consist": "组成",
    "Compose": "组成",
    "Constitute": "构成",
    "Produce": "生产",
    "Generate": "生成",
    "Develop": "发展",
    "Grow": "成长",
    "Expand": "扩展",
    "Increase": "增加",
    "Rise": "上升",
    "Ascend": "上升",
    "Climb": "攀登",
    "Build": "建造",
    "Construct": "建设",
    "Erect": "建造",
    "Establish": "建立",
    "Found": "创立",
    "Shape": "塑造",
    "Mold": "塑造",
    "Design": "设计",
    "Plan": "计划",
    "Scheme": "方案",
    "Project": "项目",
    "Program": "程序",
    "Network": "网络",
    "Web": "网络",
    "Grid": "网格",
    "Matrix": "矩阵",
    "Array": "数组",
    "Series": "系列",
    "Sequence": "序列",
    "Chain": "链",
    "String": "字符串",
    "Line": "线",
    "Row": "行",
    "Column": "列",
    "Stack": "堆栈",
    "Queue": "队列",
    "List": "列表",
    "Set": "集合",
    "Bundle": "捆绑",
    "Package": "包",
    "Parcel": "包裹",
    "Batch": "批次",
    "Lot": "批次",
    "Quantity": "数量",
    "Amount": "数量",
    "Volume": "体积",
    "Mass": "质量",
    "Weight": "重量",
    "Size": "大小",
    "Dimension": "尺寸",
    "Measurement": "测量",
    "Magnitude": "大小",
    "Scope": "范围",
    "Range": "范围",
    "Reach": "范围",
    "Span": "跨度",
    "Extent": "程度",
    "Degree": "程度",
    "Level": "级别",
    "Grade": "等级",
    "Rank": "排名",
    "Status": "状态",
    "Place": "地方",
    "Location": "位置",
    "Site": "站点",
    "Spot": "地点",
    "Page": "页面",
    "Screen": "屏幕",
    "Display": "显示",
    "Monitor": "显示器",
    "Viewer": "查看器",
    "Browser": "浏览器",
    "Navigator": "浏览器",
    "Explorer": "资源管理器",
    "Seeker": "搜索者",
    "Finder": "查找器",
    "Locator": "定位器",
    "Tracker": "跟踪器",
    "Tracer": "追踪器",
    "Follower": "追随者",
    "Pursuer": "追求者",
    "Chaser": "追逐者",
    "Hunter": "猎人",
    "Researcher": "研究员",
    "Investigator": "调查员",
    "Detective": "侦探",
    "Inspector": "检查员",
    "Examiner": "审查员",
    "Reviewer": "审查员",
    "Auditor": "审计员",
    "Checker": "检查员",
    "Tester": "测试员",
    "Verifier": "验证员",
    "Confirmer": "确认者",
    "Validator": "验证者",
    "Authenticator": "认证者",
    "Certifier": "认证者",
    "Accreditor": "认可者",
    "Recognizer": "认可者",
    "Acknowledger": "承认者",
    "Accepter": "接受者",
    "Approver": "批准者",
    "Endorser": "认可者",
    "Supporter": "支持者",
    "Advocate": "倡导者",
    "Promoter": "推动者",
    "Encourager": "鼓励者",
    "Motivator": "激励者",
    "Inspirer": "启发者",
    "Stimulator": "刺激者",
    "Provoker": "挑衅者",
    "Challenger": "挑战者",
    "Trialer": "试验者",
    "Experimenter": "实验者",
    "Demonstrator": "演示者",
    "Prover": "证明者",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isTranslating, setIsTranslating] = useState(false);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  }, []);

  // Load saved language on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "en" || saved === "zh")) {
      setLanguageState(saved);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[language][key as keyof typeof translations.en] || key;
    },
    [language]
  );

  // Client-side message translation using dictionary + simple word replacement
  const translateMessage = useCallback((text: string): string => {
    if (language === "en" || !text) return text;
    
    const cacheKey = `${language}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached) return cached.translated;

    // Simple translation: replace known phrases
    let translated = text;
    const dict = aiPhraseDictionary[language] || {};
    
    // Sort by length (longest first) to avoid partial replacements
    const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
    
    for (const [english, chinese] of entries) {
      // Case-insensitive replacement
      const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      translated = translated.replace(regex, chinese);
    }

    // Cache the result
    translationCache.set(cacheKey, {
      original: text,
      translated,
      timestamp: Date.now()
    });

    return translated;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateMessage, isTranslating }}>
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
