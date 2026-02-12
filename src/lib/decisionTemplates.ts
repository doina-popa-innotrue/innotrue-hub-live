export interface DecisionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultImportance: "low" | "medium" | "high" | "critical";
  defaultOptions: string[];
  defaultValues: string[];
  modelNotes: {
    buyers_model_notes?: string;
    ten_ten_ten_notes?: string;
    internal_check_notes?: string;
    stop_rule_notes?: string;
    yes_no_rule_notes?: string;
    crossroads_notes?: string;
  };
  reflectionPrompts: {
    what_went_well?: string;
    what_did_not_go_well?: string;
    unexpected_results?: string;
    what_i_learned?: string;
  };
}

export const decisionTemplates: DecisionTemplate[] = [
  {
    id: "career-change",
    name: "Career Change",
    description: "Evaluate a potential career transition or job change",
    category: "Career",
    icon: "briefcase",
    defaultImportance: "high",
    defaultOptions: ["Stay in current role", "Accept new opportunity", "Explore other options"],
    defaultValues: [
      "Growth & Learning",
      "Work-Life Balance",
      "Financial Security",
      "Purpose & Impact",
      "Team & Culture",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: New skills, experience, potential growth, different culture, higher compensation, expanded network\nSelling: Comfort, seniority, established relationships, current stability, proven track record, institutional knowledge",
      ten_ten_ten_notes:
        "In 10 minutes: Excitement or anxiety about change, immediate relief or regret\nIn 10 months: Adapting to new environment, learning curve, building new relationships, evaluating the decision\nIn 10 years: Career trajectory, skill development, life satisfaction, professional identity, network established",
      internal_check_notes:
        "What does my gut tell me? Does this opportunity align with my authentic self and values? What would I advise my best friend to do? What choice aligns with who I want to become?",
      crossroads_notes:
        "Staying: Deepening current expertise, stability, known challenges, continued relationships\nMoving: New learning opportunities, expanded network, career pivot potential, growth mindset\nExploring: Keeping options open, finding better fit, avoiding regret, gathering information",
    },
    reflectionPrompts: {
      what_went_well:
        "What aspects of this career decision have exceeded your expectations? What new skills or relationships have developed?",
      what_did_not_go_well:
        "What challenges or disappointments have you faced? What was harder than anticipated?",
      unexpected_results:
        "What surprising outcomes (positive or negative) have emerged? What opportunities appeared that you hadn't considered?",
      what_i_learned:
        "What have you learned about yourself and your career priorities? How has your definition of success evolved?",
    },
  },
  {
    id: "relocation",
    name: "Relocation Decision",
    description: "Decide whether to move to a new city or location",
    category: "Lifestyle",
    icon: "map-pin",
    defaultImportance: "high",
    defaultOptions: [
      "Stay in current location",
      "Relocate to new city",
      "Hybrid/gradual transition",
    ],
    defaultValues: [
      "Family & Relationships",
      "Career Opportunities",
      "Cost of Living",
      "Quality of Life",
      "Community & Social Network",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: New opportunities, different lifestyle, fresh start, adventure, career growth, lower cost of living\nSelling: Current community, established routines, proximity to loved ones, known resources, comfort zone",
      ten_ten_ten_notes:
        "In 10 minutes: Excitement or anxiety about change, saying goodbye\nIn 10 months: Adjusted to new life, built some connections, evaluated decision\nIn 10 years: Established roots (or regret), career trajectory, life satisfaction",
      crossroads_notes:
        "Moving: New opportunities, growth, adventure, potential challenges\nStaying: Deepen current connections, stability, known quality of life\nHybrid: Test before committing, maintain safety net, gather information",
      internal_check_notes:
        "Am I running toward something or away from something? What am I hoping to find? What will I miss most?",
    },
    reflectionPrompts: {
      what_went_well:
        "How has the new location enhanced your life? What opportunities have emerged?",
      what_did_not_go_well:
        "What aspects of the move have been harder than expected? What do you miss most?",
      unexpected_results:
        "What surprises have you encountered in your new environment? What connections have you made?",
      what_i_learned:
        "What have you discovered about what truly matters in where you live? How has this shaped your priorities?",
    },
  },
  {
    id: "investment",
    name: "Investment Decision",
    description: "Evaluate a financial investment or major purchase",
    category: "Financial",
    icon: "dollar-sign",
    defaultImportance: "high",
    defaultOptions: [
      "Make the investment",
      "Wait and save more",
      "Invest in alternative",
      "Don't invest",
    ],
    defaultValues: [
      "Financial Security",
      "Long-term Growth",
      "Risk Tolerance",
      "Liquidity Needs",
      "Peace of Mind",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: Potential returns, portfolio diversification, growth opportunity, passive income, inflation hedge, tax benefits\nSelling: Capital, liquidity, security, peace of mind, opportunity cost, flexibility",
      ten_ten_ten_notes:
        "In 10 minutes: Immediate commitment, resources allocated, excitement or anxiety\nIn 10 months: Early performance indicators, market conditions, staying power tested\nIn 10 years: Compounded returns or losses, portfolio balance, financial goals achieved or missed",
      stop_rule_notes:
        "I will stop/reconsider if: expected returns drop below X%, risk level exceeds comfort zone, better opportunities emerge, fundamentals change, it affects emergency fund, expert analysis contradicts thesis",
      yes_no_rule_notes:
        "If I'm not confident enough to explain this investment clearly to someone I respect, it's a no. If it feels like gambling rather than investing, it's a no.",
    },
    reflectionPrompts: {
      what_went_well:
        "How has this investment performed relative to expectations? What returns have materialized?",
      what_did_not_go_well:
        "What risks materialized that you hadn't fully considered? What losses occurred?",
      unexpected_results:
        "What market or circumstantial changes affected the outcome? What surprised you?",
      what_i_learned:
        "What have you learned about your investment approach and risk tolerance? How has this shaped your strategy?",
    },
  },
  {
    id: "education",
    name: "Education/Training Decision",
    description: "Decide on pursuing additional education or certification",
    category: "Career",
    icon: "graduation-cap",
    defaultImportance: "medium",
    defaultOptions: [
      "Enroll in full program",
      "Take selective courses",
      "Self-study alternative",
      "Defer decision",
    ],
    defaultValues: [
      "Skill Development",
      "Career Advancement",
      "ROI on Investment",
      "Time Commitment",
      "Personal Growth",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: New credentials, knowledge, network, career opportunities, personal growth, earning potential\nSelling: Time (1-4 years), tuition costs, current income, work experience, other opportunities, relationships",
      ten_ten_ten_notes:
        "In 10 minutes: Commitment to change, excitement about learning, financial commitment\nIn 10 months: Deep in studies, financial impact, new skills emerging, opportunity cost realized\nIn 10 years: Career impact, ROI realized, professional network established, skills still relevant?",
      internal_check_notes:
        "Am I doing this because I truly want to learn, or to meet others' expectations? What would feel most authentic? Am I ready to commit fully?",
      crossroads_notes:
        "Full program: Deep learning, credentials, structured path, network building\nSelective: Targeted skills, lower investment, flexibility\nSelf-study: Self-paced, lower cost, maintain income, practical focus\nDefer: Work experience, save money, clarify goals, assess alternatives",
    },
    reflectionPrompts: {
      what_went_well:
        "How has this education enhanced your capabilities and opportunities? What doors opened?",
      what_did_not_go_well:
        "What aspects were less valuable than anticipated? What challenges did you face?",
      unexpected_results:
        "What unexpected doors has this opened (or closed)? What surprised you about the experience?",
      what_i_learned:
        "What have you learned about how you learn best? How has this shaped your career direction?",
    },
  },
  {
    id: "relationship",
    name: "Relationship Decision",
    description: "Navigate an important relationship decision",
    category: "Personal",
    icon: "heart",
    defaultImportance: "critical",
    defaultOptions: [
      "Move forward/commit",
      "Take a break/pause",
      "End relationship",
      "Couples counseling",
    ],
    defaultValues: [
      "Emotional Wellbeing",
      "Trust & Communication",
      "Shared Values",
      "Growth Together",
      "Individual Autonomy",
    ],
    modelNotes: {
      internal_check_notes:
        "What does my heart truly want vs. what does my fear say? Do I feel more myself or less myself in this relationship? If I knew I'd be supported either way, what would I choose? What patterns keep repeating?",
      ten_ten_ten_notes:
        "In 10 minutes: Immediate emotional impact, sense of relief or loss\nIn 10 months: Healing, growth, new patterns, life adjustments\nIn 10 years: Life satisfaction, personal development, relationship skills learned, regrets or gratitude",
      crossroads_notes:
        "Forward: Building stronger foundation, working through issues together, deepening commitment\nPause: Space for clarity, individual growth, perspective\nEnd: Fresh start, self-discovery, new possibilities\nCounseling: Professional support, new tools, guided communication",
      yes_no_rule_notes:
        "If I have to convince myself it's right, it's probably not. Trust your intuition on alignment.",
    },
    reflectionPrompts: {
      what_went_well:
        "How has this decision strengthened your wellbeing? What positive changes have emerged?",
      what_did_not_go_well:
        "What challenges have you faced in the aftermath? What was harder than expected?",
      unexpected_results:
        "What have you discovered about yourself through this decision? What surprised you?",
      what_i_learned:
        "What patterns or insights have emerged about your needs in relationships? How have you grown?",
    },
  },
  {
    id: "business-launch",
    name: "Business Launch",
    description: "Decide whether to start a new business or side venture",
    category: "Entrepreneurship",
    icon: "rocket",
    defaultImportance: "high",
    defaultOptions: [
      "Launch full-time",
      "Start as side project",
      "Validate idea first",
      "Not the right time",
    ],
    defaultValues: [
      "Financial Independence",
      "Creative Freedom",
      "Impact & Purpose",
      "Risk Tolerance",
      "Work-Life Balance",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: Autonomy, unlimited potential, building something meaningful, equity, legacy, control\nSelling: Stable income, benefits, predictable hours, lower stress, shared responsibility, career progression",
      stop_rule_notes:
        "I will stop/pivot if: revenue doesn't hit X by date Y, burn rate exceeds Z months runway, market feedback shows fundamental flaw, it affects health/relationships severely, better opportunity emerges. Set clear criteria upfront.",
      ten_ten_ten_notes:
        "In 10 minutes: Is this fear or excitement? Am I ready for uncertainty?\nIn 10 months: Will I be glad I took this risk? Will progress justify the sacrifice?\nIn 10 years: Will I regret not trying? What will this teach me?",
      yes_no_rule_notes:
        "If I wouldn't recommend this to my best friend in the same situation, it's probably a no. If the primary motivation is escape rather than mission, reconsider.",
    },
    reflectionPrompts: {
      what_went_well:
        "What aspects of the business exceeded expectations? What traction did you gain?",
      what_did_not_go_well: "What challenges or setbacks occurred? What was your biggest mistake?",
      unexpected_results:
        "What market realities or opportunities surprised you? What pivots did you make?",
      what_i_learned:
        "What have you learned about yourself as an entrepreneur? What would you do differently?",
    },
  },
  {
    id: "home-purchase",
    name: "Home Purchase",
    description: "Decide whether to buy a home and which property",
    category: "Financial",
    icon: "home",
    defaultImportance: "critical",
    defaultOptions: [
      "Buy this property",
      "Keep searching",
      "Continue renting",
      "Wait for market change",
    ],
    defaultValues: [
      "Financial Security",
      "Location",
      "Lifestyle",
      "Long-term Value",
      "Family Needs",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: Equity building, stability, customization freedom, tax benefits, roots, forced savings, hedge against rent increases\nSelling: Flexibility, significant capital, lower stress, freedom from maintenance, no property taxes, mobility for opportunities",
      ten_ten_ten_notes:
        "In 10 minutes: Excitement about ownership, commitment anxiety, financial commitment\nIn 10 months: Settled into space, dealing with maintenance, building community, financial adjustment\nIn 10 years: Equity accumulated, life changes accommodated, neighborhood evolution, market changes",
      stop_rule_notes:
        "Stop if: inspection reveals major issues, monthly costs exceed 30% income, location doesn't meet 80% of key criteria, market conditions shift dramatically, better opportunity emerges, financial situation changes",
      crossroads_notes:
        "Buy: Building equity, stability, personalization, community roots\nSearch: Finding better fit, avoiding settling, market timing\nRent: Flexibility, lower commitment, capital preservation for other uses\nWait: Market timing, savings growth, life clarity",
    },
    reflectionPrompts: {
      what_went_well: "How has homeownership enhanced your life? What value has appreciated?",
      what_did_not_go_well:
        "What unexpected costs or challenges have emerged? What compromises feel significant?",
      unexpected_results: "What surprises about the property or neighborhood have you discovered?",
      what_i_learned:
        "What have you learned about your housing priorities? How has this shaped your lifestyle?",
    },
  },
  {
    id: "health-major",
    name: "Major Health Decision",
    description: "Make important decision about medical treatment or health intervention",
    category: "Health",
    icon: "activity",
    defaultImportance: "critical",
    defaultOptions: [
      "Proceed with treatment",
      "Seek second opinion",
      "Alternative approach",
      "Wait and monitor",
    ],
    defaultValues: [
      "Health",
      "Quality of Life",
      "Risk Tolerance",
      "Family",
      "Longevity",
      "Mobility",
    ],
    modelNotes: {
      buyers_model_notes:
        "Buying: Potential health improvement, peace of mind, symptom relief, longevity, function restoration\nSelling: Recovery time, financial cost, potential side effects, current comfort, temporary decline in function",
      internal_check_notes:
        "What does my body tell me? Do I trust this medical advice? What fears are influencing me? What would give me peace of mind? Have I explored all reasonable options?",
      stop_rule_notes:
        "Reconsider if: evidence doesn't support effectiveness, risks outweigh benefits for my situation, alternative treatments show equal promise, doctor can't clearly explain rationale, gut strongly objects, second opinion contradicts",
      ten_ten_ten_notes:
        "In 10 minutes: Immediate decision stress, relief of choosing\nIn 10 months: Recovery status, effectiveness visible, quality of life impact\nIn 10 years: Long-term health outcomes, life quality sustained, was this the right path?",
    },
    reflectionPrompts: {
      what_went_well:
        "How has this health decision improved your wellbeing? What positive changes occurred?",
      what_did_not_go_well:
        "What complications or challenges arose? What was harder than expected?",
      unexpected_results: "What surprising effects (positive or negative) have you experienced?",
      what_i_learned:
        "What have you learned about your body and health priorities? How has this changed your approach?",
    },
  },
];

export function getTemplateById(id: string): DecisionTemplate | undefined {
  return decisionTemplates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): DecisionTemplate[] {
  return decisionTemplates.filter((t) => t.category === category);
}

export const templateCategories = Array.from(new Set(decisionTemplates.map((t) => t.category)));
