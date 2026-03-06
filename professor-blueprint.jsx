import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0a0e17",
  bgCard: "#111827",
  bgCardHover: "#1a2332",
  border: "#1e293b",
  borderActive: "#c8963e",
  gold: "#c8963e",
  goldDim: "#8b6914",
  goldGlow: "rgba(200, 150, 62, 0.15)",
  goldGlowStrong: "rgba(200, 150, 62, 0.3)",
  text: "#e2e8f0",
  textDim: "#64748b",
  textMuted: "#475569",
  green: "#22c55e",
  greenDim: "#15803d",
  greenGlow: "rgba(34, 197, 94, 0.15)",
  blue: "#3b82f6",
  blueDim: "#1d4ed8",
  blueGlow: "rgba(59, 130, 246, 0.15)",
  red: "#ef4444",
  redDim: "#991b1b",
  purple: "#a855f7",
  purpleDim: "#7e22ce",
  purpleGlow: "rgba(168, 85, 247, 0.15)",
  cyan: "#06b6d4",
  cyanGlow: "rgba(6, 182, 212, 0.15)",
};

const PHASES = [
  {
    id: "month1",
    label: "Month 1",
    title: "Single Agent",
    subtitle: "Discovery → Revenue",
    color: COLORS.gold,
    glow: COLORS.goldGlow,
    icon: "🎓",
    status: "BUILD NOW",
    cost: "$15–30/mo",
    items: [
      { text: "One Telegram bot, one n8n workflow", done: false },
      { text: "Socratic Framework as core personality", done: false },
      { text: "Knowledge Injection: GS Playbook + Pricing + Vision", done: false },
      { text: "Persistent memory: clients, financials, schedule", done: false },
      { text: "Self-Healing Monitor (Loop 4)", done: false },
      { text: "Interaction logging — every message, every outcome", done: false },
      { text: "March 8 consult prep → first revenue", done: false },
    ],
    loops: ["L4"],
    agents: ["Professor"],
  },
  {
    id: "month2",
    label: "Month 2–3",
    title: "Learning Engine",
    subtitle: "Patterns → Intelligence",
    color: COLORS.green,
    glow: COLORS.greenGlow,
    icon: "🧪",
    status: "EARN INTO",
    cost: "$20–40/mo",
    items: [
      { text: "Causal Reflection (Loop 1): why did that consult convert?", done: false },
      { text: "ACE Playbook Evolution (Loop 3): weekly strategic review", done: false },
      { text: "Cross-domain pattern recognition", done: false },
      { text: "A/B testing on communication approaches", done: false },
      { text: "Outcome tracking: booked, converted, dropped, no-show", done: false },
      { text: "50+ interactions per agent threshold", done: false },
    ],
    loops: ["L1", "L3", "L4"],
    agents: ["Professor"],
  },
  {
    id: "month4",
    label: "Month 4–6",
    title: "Specialization",
    subtitle: "Personas → Domains",
    color: COLORS.blue,
    glow: COLORS.blueGlow,
    icon: "⚗️",
    status: "DATA-DRIVEN",
    cost: "$35–60/mo",
    items: [
      { text: "Professor spawns domain personas (shared memory)", done: false },
      { text: "Professor — Sales (TruBot role)", done: false },
      { text: "Professor — Ops (ScholarBot role)", done: false },
      { text: "Professor — Deals (DealBot role)", done: false },
      { text: "GEPA optimization on highest-volume persona", done: false },
      { text: "ProgramBot integration for Zach's training", done: false },
    ],
    loops: ["L1", "L2", "L3", "L4", "L5"],
    agents: ["Sales", "Ops", "Deals", "Programs"],
  },
  {
    id: "month6",
    label: "Month 6+",
    title: "Multi-Agent",
    subtitle: "The Build Guide v4.3 Activates",
    color: COLORS.purple,
    glow: COLORS.purpleGlow,
    icon: "🔬",
    status: "EARNED",
    cost: "$50–100/mo",
    items: [
      { text: "Separate agents with separate optimized prompts", done: false },
      { text: "Brain Bot as meta-coordinator", done: false },
      { text: "Cross-pollination between agent playbooks", done: false },
      { text: "Full compiler pipeline with versioning + rollback", done: false },
      { text: "Quarterly GEPA re-optimization per agent", done: false },
      { text: "Portable to every acquisition in the flywheel", done: false },
    ],
    loops: ["L1", "L2", "L3", "L4", "L5"],
    agents: ["TruBot", "ScholarBot", "DealBot", "PatentBot", "ProgramBot", "Brain", "DevBot"],
  },
];

const LOOPS = [
  {
    id: "L1",
    name: "Causal Reflection",
    model: "Sonnet",
    freq: "Weekly",
    cost: "$0.20/mo",
    color: COLORS.green,
    desc: "Analyzes top 5 vs bottom 5 interactions to find WHY outcomes differ — not just correlations, but causes.",
    when: "Month 2+",
  },
  {
    id: "L2",
    name: "Knowledge Injection",
    model: "Opus",
    freq: "Quarterly",
    cost: "$0.50/mo",
    color: COLORS.gold,
    desc: "Converts strategic documents (Playbook, Vision, Deal Memos) into structured rules via Opus extraction + human review.",
    when: "Day 4",
  },
  {
    id: "L3",
    name: "ACE Playbook Evolution",
    model: "Sonnet",
    freq: "Weekly",
    cost: "$1.00/mo",
    color: COLORS.blue,
    desc: "Generator/Reflector/Curator cycle reviews entire compiled prompt as a living strategic document. Delta updates only.",
    when: "Month 2+",
  },
  {
    id: "L4",
    name: "Self-Healing Monitor",
    model: "Code only",
    freq: "6-hourly",
    cost: "$0.00/mo",
    color: COLORS.cyan,
    desc: "5-point automated health: budget reconciliation, webhook health, Sheets API, prompt stability, decay health.",
    when: "Day 1",
  },
  {
    id: "L5",
    name: "GEPA Optimization",
    model: "Mixed",
    freq: "Quarterly",
    cost: "$3–8/mo",
    color: COLORS.purple,
    desc: "Systematically optimizes prompt STRUCTURE using execution traces. 300–1200 rollouts. Needs 100+ closed outcomes.",
    when: "Month 3+",
  },
];

const FLYWHEEL = [
  { phase: "Phase 0", name: "Garage Scholars", years: "Year 0–2", cash: "$500K–$2M/yr", color: COLORS.gold, professor: "Professor runs daily ops, client conversion, scholar management, SOP generation" },
  { phase: "Phase 1", name: "CPA Acquisition", years: "Year 1–2", cash: "$1–3M/yr", color: COLORS.green, professor: "Professor's playbook ports to acquired firm. DealBot evaluates targets. Same operating system, new vertical." },
  { phase: "Phase 2", name: "Roll-Up Flywheel", years: "Year 3–5", cash: "$5–10M/yr", color: COLORS.blue, professor: "Each acquisition gets Professor clone. Shared services. Cross-pollination learns from every business." },
  { phase: "Phase 3", name: "Scale Acquisitions", years: "Year 5–7", cash: "$10–15M/yr", color: COLORS.purple, professor: "Brain Bot coordinates across 20+ business units. GEPA-optimized per vertical. Institutional knowledge compounds." },
  { phase: "Phase 4", name: "Science Engine", years: "Year 7–10", cash: "$3–5M/yr → R&D", color: "#ef4444", professor: "Professor becomes lab manager. Patent analysis. Grant-free research funding. Science independent of politics forever." },
];

const SOCRATIC = {
  discovery: {
    icon: "🔍",
    title: "Discovery",
    color: COLORS.gold,
    desc: "Probing questions, one at a time, across operational domains. Build complete picture before designing.",
    professor: "Professor never jumps to solutions. New client? Run discovery. New acquisition? Run discovery. Always.",
  },
  architecture: {
    icon: "📐",
    title: "Architecture",
    color: COLORS.blue,
    desc: "Data models, routes, integrations. Design the technical solution from discovered reality.",
    professor: "Professor designs SOPs, workflows, and systems from Discovery outputs — not assumptions.",
  },
  build: {
    icon: "🔨",
    title: "Build",
    color: COLORS.green,
    desc: "Production code generation. Execute with precision on a foundation of understanding.",
    professor: "Professor generates code, automations, and deliverables. Never before Discovery + Architecture.",
  },
};

// --- COMPONENTS ---

function GrainOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

function Badge({ children, color, glow }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color || COLORS.gold,
        background: glow || COLORS.goldGlow,
        border: `1px solid ${color || COLORS.gold}33`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {children}
    </span>
  );
}

function TabButton({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        border: `1px solid ${active ? color || COLORS.gold : COLORS.border}`,
        borderRadius: "6px",
        background: active ? `${color || COLORS.gold}15` : "transparent",
        color: active ? color || COLORS.gold : COLORS.textDim,
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.2s",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h2
        style={{
          fontSize: "28px",
          fontWeight: 300,
          color: COLORS.text,
          margin: 0,
          fontFamily: "'Instrument Serif', Georgia, serif",
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h2>
      {sub && (
        <p
          style={{
            fontSize: "13px",
            color: COLORS.textDim,
            margin: "4px 0 0 0",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// --- VIEWS ---

function ArchitectureView() {
  const [activePhase, setActivePhase] = useState(0);
  const phase = PHASES[activePhase];

  return (
    <div>
      <SectionTitle sub="Earned progression — each phase unlocks through data, not ambition">
        Evolution Timeline
      </SectionTitle>

      {/* Phase selector */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
        {PHASES.map((p, i) => (
          <TabButton
            key={p.id}
            active={activePhase === i}
            onClick={() => setActivePhase(i)}
            color={p.color}
          >
            {p.icon} {p.label}
          </TabButton>
        ))}
      </div>

      {/* Active phase detail */}
      <div
        style={{
          background: COLORS.bgCard,
          border: `1px solid ${phase.color}33`,
          borderRadius: "10px",
          padding: "28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: `linear-gradient(90deg, transparent, ${phase.color}, transparent)`,
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <span style={{ fontSize: "32px" }}>{phase.icon}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 300, color: COLORS.text, fontFamily: "'Instrument Serif', Georgia, serif" }}>
                  {phase.title}
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: phase.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {phase.subtitle}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Badge color={phase.color} glow={phase.glow}>{phase.status}</Badge>
            <span style={{ fontSize: "13px", color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
              {phase.cost}
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ marginTop: "24px", display: "grid", gap: "8px" }}>
          {phase.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: `${phase.color}08`,
                border: `1px solid ${phase.color}15`,
              }}
            >
              <span style={{ color: phase.color, fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>
                {item.done ? "✓" : "○"}
              </span>
              <span style={{ fontSize: "13px", color: COLORS.text, lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Active loops + agents */}
        <div style={{ marginTop: "20px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "10px", color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              Active Loops
            </span>
            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
              {phase.loops.map((lid) => {
                const loop = LOOPS.find((l) => l.id === lid);
                return (
                  <Badge key={lid} color={loop.color} glow={`${loop.color}20`}>
                    {loop.name}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              Active Agents
            </span>
            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
              {phase.agents.map((a) => (
                <Badge key={a} color={COLORS.text} glow={`${COLORS.text}10`}>
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearningLoopsView() {
  const [activeLoop, setActiveLoop] = useState(null);

  return (
    <div>
      <SectionTitle sub="Five compounding intelligence layers — $1.53/mo for Loops 1–4, $4.53–9.87/mo all five">
        Learning Loops
      </SectionTitle>

      <div style={{ display: "grid", gap: "10px" }}>
        {LOOPS.map((loop) => {
          const isActive = activeLoop === loop.id;
          return (
            <div
              key={loop.id}
              onClick={() => setActiveLoop(isActive ? null : loop.id)}
              style={{
                background: isActive ? COLORS.bgCardHover : COLORS.bgCard,
                border: `1px solid ${isActive ? loop.color + "55" : COLORS.border}`,
                borderRadius: "10px",
                padding: "18px 22px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: `${loop.color}15`,
                      border: `1px solid ${loop.color}33`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: loop.color,
                      fontFamily: "'JetBrains Mono', monospace",
                      flexShrink: 0,
                    }}
                  >
                    {loop.id}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 500, color: COLORS.text }}>{loop.name}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
                      {loop.model} · {loop.freq} · {loop.cost}
                    </div>
                  </div>
                </div>
                <Badge color={loop.color} glow={`${loop.color}20`}>{loop.when}</Badge>
              </div>

              {isActive && (
                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: `1px solid ${COLORS.border}`,
                    fontSize: "13px",
                    color: COLORS.textDim,
                    lineHeight: 1.7,
                  }}
                >
                  {loop.desc}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Loop flow diagram */}
      <div
        style={{
          marginTop: "28px",
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          borderRadius: "10px",
          padding: "24px",
        }}
      >
        <div style={{ fontSize: "10px", color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "16px" }}>
          Data Flow
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: COLORS.textDim, lineHeight: 2.2, whiteSpace: "pre-wrap" }}>
          <span style={{ color: COLORS.gold }}>Interaction</span> → <span style={{ color: COLORS.text }}>Log</span> → <span style={{ color: COLORS.green }}>Outcome Closure</span> → <span style={{ color: COLORS.blue }}>Confidence Update</span>{"\n"}
          {"  "}├── <span style={{ color: COLORS.green }}>L1: Causal Reflection</span> → WHY did top 5 succeed?{"\n"}
          {"  "}├── <span style={{ color: COLORS.blue }}>L3: ACE Evolution</span> → Delta updates to playbook{"\n"}
          {"  "}└── <span style={{ color: COLORS.purple }}>L5: GEPA</span> → Optimize prompt structure{"\n"}
          {"  "}{"    "}↓{"\n"}
          {"  "}<span style={{ color: COLORS.gold }}>Compiler</span> → <span style={{ color: COLORS.text }}>Updated Prompt</span> → <span style={{ color: COLORS.green }}>Better Interaction</span>{"\n"}
          {"\n"}
          <span style={{ color: COLORS.cyan }}>L4: Self-Healing</span> → Monitors all of the above (6-hourly){"\n"}
          <span style={{ color: COLORS.gold }}>L2: Knowledge Injection</span> → Strategic docs → One-time seed + quarterly refresh
        </div>
      </div>
    </div>
  );
}

function SocraticView() {
  return (
    <div>
      <SectionTitle sub="Discovery → Architecture → Build — Professor's operating system, inherited from the Socratic Framework">
        The Socratic Core
      </SectionTitle>

      <div style={{ display: "grid", gap: "12px" }}>
        {Object.values(SOCRATIC).map((phase) => (
          <div
            key={phase.title}
            style={{
              background: COLORS.bgCard,
              border: `1px solid ${phase.color}33`,
              borderRadius: "10px",
              padding: "22px 26px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "3px",
                background: phase.color,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <span style={{ fontSize: "24px" }}>{phase.icon}</span>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 400, color: phase.color, fontFamily: "'Instrument Serif', Georgia, serif" }}>
                {phase.title}
              </h3>
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: COLORS.text, lineHeight: 1.6 }}>
              {phase.desc}
            </p>
            <div
              style={{
                padding: "10px 14px",
                background: `${phase.color}08`,
                borderRadius: "6px",
                border: `1px solid ${phase.color}15`,
                fontSize: "12px",
                color: COLORS.textDim,
                lineHeight: 1.5,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ color: phase.color, fontWeight: 600 }}>Professor: </span>
              {phase.professor}
            </div>
          </div>
        ))}
      </div>

      {/* Integration callout */}
      <div
        style={{
          marginTop: "24px",
          background: `${COLORS.gold}08`,
          border: `1px solid ${COLORS.gold}22`,
          borderRadius: "10px",
          padding: "22px 26px",
        }}
      >
        <div style={{ fontSize: "10px", color: COLORS.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "10px" }}>
          Framework Integration
        </div>
        <div style={{ fontSize: "13px", color: COLORS.textDim, lineHeight: 1.7 }}>
          The Socratic Framework is baked into Professor's system prompt as a hard constraint.
          When Professor receives any new request — client consult, acquisition analysis, SOP generation,
          financial review — it triggers Discovery mode first. No exceptions. This is what separates
          Professor from a generic assistant: it asks before it acts, and it learns from every answer.
        </div>
      </div>
    </div>
  );
}

function FlywheelView() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div>
      <SectionTitle sub="Making science independent of political and economic fluctuation — the mission Professor serves">
        The Flywheel
      </SectionTitle>

      {/* Flywheel steps */}
      <div style={{ display: "grid", gap: "2px", marginBottom: "24px" }}>
        {FLYWHEEL.map((step, i) => {
          const isActive = activeStep === i;
          return (
            <div
              key={step.phase}
              onClick={() => setActiveStep(i)}
              style={{
                background: isActive ? COLORS.bgCardHover : COLORS.bgCard,
                border: `1px solid ${isActive ? step.color + "55" : COLORS.border}`,
                borderRadius: i === 0 ? "10px 10px 2px 2px" : i === FLYWHEEL.length - 1 ? "2px 2px 10px 10px" : "2px",
                padding: "16px 22px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: step.color,
                      boxShadow: isActive ? `0 0 12px ${step.color}88` : "none",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: COLORS.text }}>{step.name}</span>
                    <span style={{ fontSize: "12px", color: COLORS.textDim, marginLeft: "10px", fontFamily: "'JetBrains Mono', monospace" }}>{step.phase}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{step.years}</span>
                  <Badge color={step.color} glow={`${step.color}20`}>{step.cash}</Badge>
                </div>
              </div>

              {isActive && (
                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "14px",
                    borderTop: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ fontSize: "10px", color: step.color, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>
                    Professor's Role
                  </div>
                  <div style={{ fontSize: "13px", color: COLORS.textDim, lineHeight: 1.6 }}>
                    {step.professor}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mission callout */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.bgCard} 0%, #1a0e0e 100%)`,
          border: `1px solid ${COLORS.red}33`,
          borderRadius: "10px",
          padding: "26px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: `linear-gradient(90deg, transparent, ${COLORS.red}, transparent)`,
          }}
        />
        <div style={{ fontSize: "10px", color: COLORS.red, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px" }}>
          The Endgame — Never Forget This Task
        </div>
        <p style={{ margin: 0, fontSize: "16px", color: COLORS.text, lineHeight: 1.7, fontFamily: "'Instrument Serif', Georgia, serif" }}>
          Making science, engineering, and innovation independent of political or economic fluctuation.
          Every system Professor builds, every dollar of revenue it helps generate, every acquisition it helps
          evaluate — all of it compounds toward a permanent, self-sustaining research engine that answers
          to no grant committee, no VC fund, and no political cycle.
        </p>
        <p style={{ margin: "16px 0 0 0", fontSize: "13px", color: COLORS.textDim, lineHeight: 1.6 }}>
          $3–5M/year in permanent science funding. A biotech incubator with shared lab space.
          A PhD scientist who proved you can build your way to freedom instead of asking for permission.
        </p>
      </div>
    </div>
  );
}

function TechStackView() {
  const stack = [
    {
      layer: "Interface",
      items: [
        { name: "Telegram Bot", role: "Primary interface — you message Professor from anywhere", status: "Day 1" },
        { name: "n8n Webhooks", role: "Receives, routes, and processes all messages", status: "Day 1" },
      ],
    },
    {
      layer: "Intelligence",
      items: [
        { name: "Claude Sonnet", role: "Default model — 90% of interactions. Fast, cheap, capable.", status: "Day 1" },
        { name: "Claude Opus", role: "Strategic analysis, knowledge extraction, complex reasoning", status: "Day 1" },
        { name: "Claude Haiku", role: "Classification, routing, cost fallback. ~$0.001/message.", status: "Day 1" },
      ],
    },
    {
      layer: "Memory",
      items: [
        { name: "Google Sheets", role: "Interaction log, learnings registry, cost tracking, config", status: "Day 1" },
        { name: "ACE Playbook", role: "Evolving strategy document — delta updates, never full rewrites", status: "Month 2" },
        { name: "Knowledge Base", role: "Injected strategic docs: Playbook, Vision, Pricing, Deal Memos", status: "Day 4" },
      ],
    },
    {
      layer: "Learning",
      items: [
        { name: "Causal Reflector", role: "Sonnet analyzes why interactions succeed/fail", status: "Month 2" },
        { name: "ACE Curator", role: "Weekly delta updates to compiled prompts", status: "Month 2" },
        { name: "GEPA Optimizer", role: "Prompt structure optimization from execution traces", status: "Month 3+" },
        { name: "Compiler", role: "Merges all rules into deployable system prompt per agent", status: "Day 1" },
      ],
    },
    {
      layer: "Safety",
      items: [
        { name: "Self-Healing Monitor", role: "5-point health check every 6 hours", status: "Day 1" },
        { name: "Budget System", role: "$30/mo cap, 60s cache, idempotency guards, model downgrade", status: "Day 1" },
        { name: "Auth", role: "Hardcoded whitelist + rate limiter. No unauthorized access.", status: "Day 1" },
      ],
    },
  ];

  return (
    <div>
      <SectionTitle sub="Every layer mapped — what runs, what it costs, when it activates">
        Tech Stack
      </SectionTitle>

      <div style={{ display: "grid", gap: "16px" }}>
        {stack.map((group) => (
          <div key={group.layer}>
            <div
              style={{
                fontSize: "10px",
                color: COLORS.gold,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: "8px",
                paddingLeft: "4px",
              }}
            >
              {group.layer}
            </div>
            <div style={{ display: "grid", gap: "4px" }}>
              {group.items.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: COLORS.text }}>{item.name}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "2px" }}>{item.role}</div>
                  </div>
                  <Badge
                    color={item.status === "Day 1" ? COLORS.gold : item.status === "Day 4" ? COLORS.green : COLORS.blue}
                    glow={item.status === "Day 1" ? COLORS.goldGlow : item.status === "Day 4" ? COLORS.greenGlow : COLORS.blueGlow}
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Day1View() {
  const tasks = [
    {
      time: "Hour 1–2",
      title: "n8n + Sheets Foundation",
      items: [
        "Set up n8n instance (self-hosted or cloud)",
        "Create Google Sheet: config, interaction_log, learnings_registry, cost_tracking",
        "Configure Telegram bot via BotFather → get token",
        "Wire Telegram webhook → n8n workflow trigger",
      ],
    },
    {
      time: "Hour 2–3",
      title: "Professor System Prompt",
      items: [
        "Write system prompt with Socratic Framework baked in",
        "Include: Discovery→Architecture→Build hard constraint",
        "Include: GS pricing tiers, crew sizes, material costs",
        "Include: Flywheel vision context (why this exists)",
        "Include: Tyler/Zach roles and communication preferences",
      ],
    },
    {
      time: "Hour 3–4",
      title: "Router + Cost Controls",
      items: [
        "Haiku classifier: route to Sonnet (default) or Opus (strategic)",
        "Hardcoded auth whitelist (Tyler + Zach chat IDs)",
        "Budget tracking: log every API call cost to Sheets",
        "Idempotency guard: message_uuid dedup",
        "Model downgrade: Opus → Sonnet → Haiku on 529/503",
      ],
    },
    {
      time: "Hour 4–5",
      title: "Knowledge Injection (Loop 2)",
      items: [
        "Feed GS Playbook to Opus → extract structured rules",
        "Feed Flywheel Vision doc → extract strategic rules",
        "Feed Pricing Structure → extract operational rules",
        "Review + approve rules via Telegram",
        "Batch load to learnings_registry → compile",
      ],
    },
    {
      time: "Hour 5–6",
      title: "Self-Healing + Testing",
      items: [
        "Deploy Self-Healing Monitor (Loop 4) — 6-hour cron",
        "Test: send messages, verify routing, check cost logging",
        "Test: ask Professor about March 8 consult → verify Socratic mode",
        "Test: ask strategic question → verify Opus routing",
        "Set up heartbeat alert channel",
      ],
    },
  ];

  return (
    <div>
      <SectionTitle sub="Six hours from zero to operational — everything you need to build Professor Day 1">
        Build Plan
      </SectionTitle>

      <div style={{ position: "relative", paddingLeft: "28px" }}>
        {/* Timeline line */}
        <div
          style={{
            position: "absolute",
            left: "8px",
            top: "8px",
            bottom: "8px",
            width: "2px",
            background: `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.green}, ${COLORS.blue})`,
            borderRadius: "1px",
          }}
        />

        <div style={{ display: "grid", gap: "20px" }}>
          {tasks.map((block, i) => (
            <div key={i} style={{ position: "relative" }}>
              {/* Timeline dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-24px",
                  top: "14px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: COLORS.bgCard,
                  border: `2px solid ${COLORS.gold}`,
                }}
              />

              <div
                style={{
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "10px",
                  padding: "18px 22px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: COLORS.text }}>
                    {block.title}
                  </h4>
                  <Badge>{block.time}</Badge>
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  {block.items.map((item, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        fontSize: "12px",
                        color: COLORS.textDim,
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: COLORS.gold, flexShrink: 0 }}>○</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* March 8 callout */}
      <div
        style={{
          marginTop: "28px",
          background: `${COLORS.gold}08`,
          border: `1px solid ${COLORS.gold}22`,
          borderRadius: "10px",
          padding: "22px 26px",
        }}
      >
        <div style={{ fontSize: "10px", color: COLORS.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "8px" }}>
          First Mission — March 8 Consultation
        </div>
        <div style={{ fontSize: "13px", color: COLORS.textDim, lineHeight: 1.7 }}>
          Professor's first real job: help you prep for the consultation with Zach's PT patient.
          Two houses, both garages. Professor runs Discovery on the customer's needs, recommends tier
          (likely Valedictorian at $7,997 — highest profit job), generates SOP from photos, drafts
          follow-up email. Every interaction logged. Every outcome tracked. The learning engine starts here.
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP ---

const TABS = [
  { id: "arch", label: "Architecture", icon: "◆" },
  { id: "loops", label: "Learning Loops", icon: "↻" },
  { id: "socratic", label: "Socratic Core", icon: "?" },
  { id: "flywheel", label: "Flywheel", icon: "⟳" },
  { id: "stack", label: "Tech Stack", icon: "▤" },
  { id: "day1", label: "Build Plan", icon: "▶" },
];

export default function ProfessorBlueprint() {
  const [activeTab, setActiveTab] = useState("arch");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <GrainOverlay />

      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "20px 28px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: `${COLORS.bg}ee`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: `linear-gradient(135deg, ${COLORS.gold}22, ${COLORS.gold}08)`,
                border: `1px solid ${COLORS.gold}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🎓
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 300,
                  letterSpacing: "-0.01em",
                  fontFamily: "'Instrument Serif', Georgia, serif",
                }}
              >
                Professor
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: COLORS.textDim,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Sodia Holdings · Personal Intelligence System
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "11px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
              {time.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <Badge color={COLORS.green} glow={COLORS.greenGlow}>
              Discovery → Architecture → Build
            </Badge>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "12px 28px",
          borderBottom: `1px solid ${COLORS.border}`,
          overflowX: "auto",
          background: `${COLORS.bg}cc`,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: activeTab === tab.id ? COLORS.bgCardHover : "transparent",
              color: activeTab === tab.id ? COLORS.gold : COLORS.textDim,
              fontSize: "12px",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ marginRight: "6px", opacity: 0.6 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "28px", maxWidth: "900px" }}>
        {activeTab === "arch" && <ArchitectureView />}
        {activeTab === "loops" && <LearningLoopsView />}
        {activeTab === "socratic" && <SocraticView />}
        {activeTab === "flywheel" && <FlywheelView />}
        {activeTab === "stack" && <TechStackView />}
        {activeTab === "day1" && <Day1View />}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "11px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          Professor Blueprint v1.0 · Sodia Holdings LLC
        </span>
        <span style={{ fontSize: "11px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", fontStyle: "italic" }}>
          Science freedom starts with revenue. Revenue starts with the next customer.
        </span>
      </div>
    </div>
  );
}
