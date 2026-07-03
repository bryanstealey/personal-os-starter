"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

// Stamped into the generated config so each tester's build is identifiable
// (pending a real update channel — fixes are hand-delivered for now).
const KIT_VERSION = "0.1.0-test";

interface UserConfig {
  kitVersion: string;
  // ISO timestamp stamped when the user first starts the wizard. The installer
  // seeds setup-state.json from this; a non-null value means "resume," not "fresh."
  startedAt: string | null;
  platform: "mac" | "pc" | null;
  systemName: string;
  preflight: {
    ownTerminal: boolean;
    ghostty: boolean;
    windowsTerminal: boolean;
    wsl: boolean;
    obsidian: boolean;
    node: boolean;
    claudeCode: boolean;
  };
  // Terminal is optional — users may keep the terminal they already use.
  useOwnTerminal: boolean;
  permissionMode: "auto" | "restrictive" | "permissive";
  terminalTheme: "light" | "dark";
  // "personal" = consumer @gmail.com; "workspace" = corporate Google Workspace
  // (may be admin-locked — SETUP branches on this).
  googleAccounts: {
    email: string;
    label: string;
    accountType: "personal" | "workspace";
    // Redundant with accountType, kept explicit so the runbook can branch on
    // this field name directly without re-deriving it.
    corporateWorkspace: boolean;
    useForEmail: boolean;
    useForCalendar: boolean;
  }[];
  businessPersonalSplit: boolean;
  taskSystem: "google-tasks" | "todoist" | "other";
  taskSystemOther?: string;
  github: {
    hasAccount: boolean;
    username: string;
  };
  dictation: {
    choice: "wispr-flow" | "handy" | "voiceink" | "other" | "skip";
    other?: string;
  };
  financialInterest: "yes" | "no" | "later";
  optionalSkills: Record<string, boolean>;
  interestedModules: {
    emailSentinel: boolean;
    notifications: boolean;
  };
  buckets: string[];
  contextSources: Record<string, boolean>;
  userName: string;
  timezone: string;
  alphaAcknowledged: boolean;
  costAcknowledged: boolean;
}

const DEFAULT_CONFIG: UserConfig = {
  kitVersion: KIT_VERSION,
  startedAt: null,
  platform: null,
  systemName: "",
  preflight: {
    ownTerminal: false,
    ghostty: false,
    windowsTerminal: false,
    wsl: false,
    obsidian: false,
    node: false,
    claudeCode: false,
  },
  useOwnTerminal: false,
  permissionMode: "auto",
  terminalTheme: "light",
  googleAccounts: [
    {
      email: "",
      label: "Primary",
      accountType: "personal",
      corporateWorkspace: false,
      useForEmail: true,
      useForCalendar: true,
    },
  ],
  businessPersonalSplit: false,
  taskSystem: "google-tasks",
  github: { hasAccount: false, username: "" },
  dictation: { choice: "wispr-flow" },
  financialInterest: "later",
  optionalSkills: {},
  interestedModules: { emailSentinel: false, notifications: false },
  buckets: [],
  contextSources: {},
  userName: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  alphaAcknowledged: false,
  costAcknowledged: false,
};

const CONTEXT_SOURCES = [
  {
    id: "chatgpt",
    name: "ChatGPT / AI conversations",
    description: "Export your conversation history or ask ChatGPT to generate a structured handoff covering your key contacts, projects, and responsibilities.",
    instructions: "Ask ChatGPT: 'I'm migrating to a knowledge base in an Obsidian vault. Generate a structured handoff covering my key contacts (name, role, relationship, how we work together), active projects (status, next steps, blockers), and ongoing responsibilities. Format each as a standalone markdown file with a description field and topics field in YAML frontmatter at the top.'",
  },
  {
    id: "google-docs",
    name: "Google Docs / Drive",
    description: "Documents, spreadsheets, and files that contain project context, meeting notes, or reference material.",
    instructions: "During setup, Claude will help you identify which Drive files to reference and create vault entries that link back to them.",
  },
  {
    id: "apple-notes",
    name: "Apple Notes",
    description: "Quick captures, lists, and notes you've accumulated over time.",
    instructions: "Export your notes as text files and drop them into your vault's 00-inbox/ folder. Claude will help you sort and route them during setup.",
  },
  {
    id: "email",
    name: "Email (contacts & relationships)",
    description: "Your inbox is a map of your relationships. Claude can scan it to identify key contacts and their context.",
    instructions: "During setup, Claude will connect to your Gmail and help you identify your most important contacts and create person files for them.",
  },
  {
    id: "calendar",
    name: "Calendar (recurring meetings)",
    description: "Recurring meetings reveal your ongoing relationships and commitments. A calendar scan builds context fast.",
    instructions: "During setup, Claude will read your calendar to identify recurring meetings and the people in them.",
  },
  {
    id: "bookmarks",
    name: "Browser bookmarks",
    description: "Saved links often represent interests, research threads, and tools you rely on.",
    instructions: "Export your bookmarks and drop them into 00-inbox/. Claude will help categorize them into your bucket structure.",
  },
  {
    id: "task-lists",
    name: "Existing task lists",
    description: "Your current to-do lists contain context about what you're working on and what's been deferred.",
    instructions: "During setup, Claude will connect to your task system and use your existing tasks to populate bucket manifests with real context.",
  },
  {
    id: "other-ai",
    name: "Other AI tools (Gemini, Copilot, etc.)",
    description: "If you've used other AI assistants, they hold conversation context that can be exported.",
    instructions: "Export conversation histories and drop them into 00-inbox/. Claude will extract actionable context during setup.",
  },
];

const OPTIONAL_SKILLS = [
  {
    id: "x-reader",
    name: "X/Twitter Reader",
    description:
      "Extracts full content from tweets — resolves shortened links, gets full text, engagement stats, and media. Useful if you save things on X throughout the day and want your system to read them.",
    invokeType: "system" as const,
  },
  {
    id: "imessage-capture",
    name: "iMessage Self-Text Capture",
    description:
      "Monitors your iMessage for self-texts and routes them into your vault's brain dump, so the ideas and reminders you fire off to yourself never get lost.",
    note: "Requires macOS, and you'll need to grant your terminal Full Disk Access in System Settings → Privacy & Security so it can read the Messages database. Setup will walk you through it.",
    invokeType: "system" as const,
  },
];

const DICTATION_OPTIONS: {
  id: "wispr-flow" | "handy" | "voiceink";
  name: string;
  price: string;
  desc: string;
  link: string;
}[] = [
  {
    id: "wispr-flow",
    name: "Wispr Flow",
    price: "$15/mo ($12/mo billed annually) · free tier capped at 2,000 words/week",
    desc: "What Bryan uses. Polished, cloud-based, learns your vocabulary over time. Verified pricing as of July 2026 — pricing may have changed, check their site.",
    link: "https://wisprflow.ai",
  },
  {
    id: "handy",
    name: "Handy",
    price: "Free, forever",
    desc: "Free, open-source (MIT), runs fully offline — nothing leaves your Mac. Less polished text-cleanup than Wispr Flow, but zero cost and zero cloud dependency. The pick if you want to try dictation before paying for anything.",
    link: "https://handy.computer",
  },
  {
    id: "voiceink",
    name: "VoiceInk",
    price: "$25 one-time (Solo license) — not a subscription",
    desc: "Open-source code, local Whisper models, one-time purchase instead of a monthly fee. A middle ground between Handy and Wispr Flow. Verified pricing as of July 2026 — pricing may have changed, check their site.",
    link: "https://tryvoiceink.com",
  },
];

const BUCKET_SUGGESTIONS = [
  "Career / Work",
  "Side Projects",
  "Finances",
  "Health & Fitness",
  "Learning",
  "Home",
  "Family",
  "Relationships",
  "Creative Projects",
  "Investments",
  "Business Admin",
  "Travel",
];

const TOTAL_STEPS = 15;

function ProgressBar({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 mb-8">
      <div
        className="bg-[#16A34A] h-1.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StepShell({
  step,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
  hideNext = false,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNext?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <ProgressBar step={step} />
      <div className="max-w-2xl mx-auto w-full flex-1">
        <p className="text-[#94A3B8] text-sm font-medium tracking-wide uppercase mb-2">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <h2 className="text-3xl font-bold tracking-tight mb-2">{title}</h2>
        {subtitle && (
          <p className="text-[#475569] text-lg mb-8">{subtitle}</p>
        )}
        <div className="mb-8">{children}</div>
      </div>
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pt-6 border-t border-[#E2E8F0]">
        {onBack ? (
          <button
            onClick={onBack}
            className="text-[#475569] hover:text-[#1A1A1A] transition-colors text-sm font-medium"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}
        {!hideNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="bg-[#16A34A] text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-[#15803D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function DisclaimerStep({
  config,
  setConfig,
  onNext,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
      <div className="bg-[#1E293B] rounded-2xl p-8 mb-8 w-full">
        <p className="text-[#FDE68A] text-xs font-semibold uppercase tracking-wider mb-3">
          Before you install anything
        </p>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
          This is an alpha
        </h1>
        <p className="text-[#94A3B8] text-lg leading-relaxed">
          If you&apos;re seeing it, you&apos;re testing it. I want any and all
          feedback &mdash; what worked, what confused you, what broke.
        </p>
      </div>

      <div className="text-left space-y-4 mb-8 w-full">
        <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl p-5">
          <p className="font-semibold text-sm text-[#854D0E] mb-2">
            Install at your own risk.
          </p>
          <p className="text-[#854D0E] text-sm leading-relaxed">
            This system gives AI agents real access to your computer and your
            accounts. Agents are not perfect, and nobody fully knows what&apos;s
            up yet &mdash; there&apos;s always a chance something unexpected
            happens. I&apos;ve built guardrails everywhere I can (you&apos;ll see
            them during setup), but installing this means you&apos;re
            comfortable with that trade-off.
          </p>
          <p className="text-[#854D0E] text-sm leading-relaxed mt-3">
            There&apos;s an{" "}
            <a
              href="https://github.com/bryanstealey/personal-os-starter/blob/main/UNINSTALL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              UNINSTALL guide
            </a>{" "}
            that reverses every system-level change if you decide it&apos;s not
            for you.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 mb-8 w-full text-left cursor-pointer">
        <input
          type="checkbox"
          checked={config.alphaAcknowledged}
          onChange={(e) =>
            setConfig({ ...config, alphaAcknowledged: e.target.checked })
          }
          className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
        />
        <p className="text-[#475569] text-sm">
          I understand this is alpha software with real access to my computer
          and accounts, and I&apos;m installing at my own risk.
        </p>
      </label>

      <button
        onClick={onNext}
        disabled={!config.alphaAcknowledged}
        className={`px-10 py-4 rounded-lg font-semibold text-lg transition-colors ${
          config.alphaAcknowledged
            ? "bg-[#16A34A] text-white hover:bg-[#15803D]"
            : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
        }`}
      >
        I understand &mdash; continue
      </button>
    </div>
  );
}

function CostGateStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        What this costs to run
      </h1>
      <p className="text-[#475569] text-lg mb-8">
        You need a paid Claude plan. Know this before you invest the next 20
        minutes.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full mb-6">
        <div className="p-6 rounded-2xl border-2 border-[#E2E8F0] bg-white text-left">
          <p className="text-2xl font-bold mb-1">$20/mo</p>
          <p className="font-semibold text-sm mb-2">Claude Pro</p>
          <p className="text-[#475569] text-sm leading-relaxed">
            The minimum. Worth a shot at first &mdash; but it will probably not
            be enough if you use this system as your daily driver.
          </p>
        </div>
        <div className="p-6 rounded-2xl border-2 border-[#16A34A] bg-[#DCFCE7]/30 text-left">
          <p className="text-2xl font-bold mb-1">$100/mo</p>
          <p className="font-semibold text-sm mb-2">Claude Max</p>
          <p className="text-[#475569] text-sm leading-relaxed">
            &ldquo;I&apos;m a heavy user and I pretty much need this &mdash; when
            you move up, it&apos;s well worth it.&rdquo;
          </p>
        </div>
      </div>

      <div className="bg-[#F1F5F9] rounded-xl p-5 text-left w-full mb-8">
        <p className="text-[#475569] text-sm leading-relaxed">
          Heavy moments &mdash; like the initial population of your knowledge
          base, where your agent reads your email and files &mdash; burn
          through limits fastest.
        </p>
        <p className="text-[#475569] text-sm leading-relaxed mt-3">
          One lesson from Bryan&apos;s own system: scheduled background agents
          share your account limits and can starve each other. You&apos;ll
          learn to pace them.
        </p>
      </div>

      <label className="flex items-start gap-3 mb-8 w-full text-left cursor-pointer">
        <input
          type="checkbox"
          checked={config.costAcknowledged}
          onChange={(e) =>
            setConfig({ ...config, costAcknowledged: e.target.checked })
          }
          className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
        />
        <p className="text-[#475569] text-sm">
          I understand I need a paid Claude plan, and that heavy daily use
          likely means Max, not Pro.
        </p>
      </label>

      <div className="flex items-center gap-6">
        <button
          onClick={onBack}
          className="text-[#475569] hover:text-[#1A1A1A] transition-colors text-sm font-medium"
        >
          &larr; Back
        </button>
        <button
          onClick={onNext}
          disabled={!config.costAcknowledged}
          className={`px-10 py-4 rounded-lg font-semibold text-lg transition-colors ${
            config.costAcknowledged
              ? "bg-[#16A34A] text-white hover:bg-[#15803D]"
              : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
      <div className="bg-[#1E293B] rounded-2xl p-8 mb-8 w-full">
        <Image
          src="/images/morgantown-ai-on-dark-logo.png"
          alt="Morgantown AI"
          width={240}
          height={60}
          className="mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
          Personal OS Setup
        </h1>
        <p className="text-[#94A3B8] text-lg">
          Less chaos. More done. Every day.
        </p>
      </div>

      <div className="text-left space-y-4 mb-8 w-full">
        <p className="text-[#475569] text-lg leading-relaxed">
          A personal operating system is a single place that holds the context of
          your life &mdash; the people, projects, money, and decisions you carry
          around in your head &mdash; paired with an AI partner that can actually
          read it and act on it. It runs on three tools:
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "Obsidian", role: "Your knowledge vault" },
            { name: "Claude Code", role: "Your AI partner" },
            { name: "Terminal", role: "Where you run it" },
          ].map((tool) => (
            <div
              key={tool.name}
              className="bg-[#F1F5F9] rounded-xl p-4 text-center"
            >
              <p className="font-semibold text-sm">{tool.name}</p>
              <p className="text-[#94A3B8] text-xs mt-1">{tool.role}</p>
            </div>
          ))}
        </div>
        <p className="text-[#475569] leading-relaxed">
          This kit works in <strong className="text-[#1A1A1A]">two phases</strong>.
          Phase 1 is this app &mdash; right here &mdash; where you&apos;ll learn how
          the system thinks, tell it about your stack, and generate your personal
          config. Phase 2 happens in your terminal: Claude Code reads that config
          and drives the install from a runbook, step by step.
        </p>
        <p className="text-[#475569] leading-relaxed">
          Early on, the install is runbook-driven &mdash; you&apos;re following a
          script, not freestyling. But your agent accumulates real context about
          you as it goes.{" "}
          <strong className="text-[#1A1A1A]">By the end</strong> you&apos;ll have
          an intelligent partner that actually knows your system, a working vault
          seeded with your real context, and two daily rituals &mdash; a morning
          launchpad and an evening shutdown &mdash; that you&apos;ll have already
          run once. From that point on, when you&apos;re not sure about anything,
          you just ask it. You work it out together.
        </p>
        <div className="bg-[#DCFCE7]/50 border border-[#16A34A]/20 rounded-xl p-4">
          <p className="text-[#475569] leading-relaxed text-[15px]">
            <strong className="text-[#16A34A]">It compounds.</strong> Every note
            you capture, every project you add, every decision you log makes the
            system &mdash; and your assistant &mdash; a little sharper. A week in
            it&apos;s useful. A month in it&apos;s the first thing you open every
            day.
          </p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="bg-[#16A34A] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#15803D] transition-colors"
      >
        Let&apos;s build it
      </button>
    </div>
  );
}

function ConceptStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [panel, setPanel] = useState(0);

  const panels: {
    eyebrow: string;
    title: string;
    body: React.ReactNode;
  }[] = [
    {
      eyebrow: "The idea",
      title: "What this is",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            Cortex is the original &mdash; the system Bryan built to run his
            life through a command center: everything he&apos;s responsible
            for, wants to do, wants to get better at.
          </p>
          <div className="bg-[#F1F5F9] rounded-xl p-5">
            <p className="text-[#475569] leading-relaxed">
              The strength is that it uses <strong className="text-[#1A1A1A]">YOUR</strong> computer
              and connects to <strong className="text-[#1A1A1A]">YOUR</strong> actual
              tools. You end up dictating to a staff.
            </p>
            <p className="text-[#475569] leading-relaxed mt-3">
              The agents are the staff members.
            </p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: "The heart of it",
      title: "The two questions",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            High-level AI use comes down to two questions, every time:
          </p>
          <div className="space-y-3">
            <div className="border border-[#E2E8F0] rounded-xl p-4 flex gap-3">
              <p className="font-bold text-[#16A34A] text-lg leading-none">1</p>
              <div>
                <p className="font-semibold text-sm">What&apos;s the context?</p>
                <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                  What exists on your computer and in your head that would
                  help?
                </p>
              </div>
            </div>
            <div className="border border-[#E2E8F0] rounded-xl p-4 flex gap-3">
              <p className="font-bold text-[#16A34A] text-lg leading-none">2</p>
              <div>
                <p className="font-semibold text-sm">What do you want?</p>
              </div>
            </div>
          </div>
          <div className="bg-[#DCFCE7]/50 border border-[#16A34A]/20 rounded-xl p-4">
            <p className="text-[#475569] leading-relaxed text-[15px]">
              This system exists to answer #1 permanently, so you only ever
              have to say #2.
            </p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: "A tip before you start",
      title: "Dictation",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            It&apos;s hard to flow when you&apos;re typing, and this whole
            system is built around flow. Dictation isn&apos;t mandatory, but
            it&apos;s really highly recommended.
          </p>
          <p className="text-[#475569] leading-relaxed">
            &ldquo;I use Wispr Flow. Smarter dictation software beats what
            comes native on your Mac because it learns from you and gets much
            cleaner.&rdquo;
          </p>
          <div className="space-y-2">
            {DICTATION_OPTIONS.map((opt) => (
              <a
                key={opt.id}
                href={opt.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-[#E2E8F0] rounded-xl p-4 hover:border-[#16A34A] transition-colors"
              >
                <p className="font-semibold text-sm">
                  {opt.name} <span className="text-[#16A34A] text-xs">&nearr;</span>
                </p>
                <p className="text-[#16A34A] text-xs font-medium mt-1">
                  {opt.price}
                </p>
                <p className="text-[#475569] text-xs mt-1 leading-relaxed">
                  {opt.desc}
                </p>
              </a>
            ))}
          </div>
        </div>
      ),
    },
    {
      eyebrow: "The trade-off",
      title: "Access = power",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            The more you give your system access to, the more powerful it is.
            If you have to be very gated about information or tools, those are
            limiting factors.
          </p>
          <div className="bg-[#F1F5F9] rounded-xl p-5">
            <p className="text-[#475569] leading-relaxed">
              &ldquo;My approach: batten down every controllable risk so I can
              afford to be aggressive with agents. It&apos;s not a perfect
              handoff, but it is a perfect trade-off.&rdquo;
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Auto permission mode — flow, with protection from the most dangerous actions",
              "Read-only financial tools only",
              "Private repos, always",
              "Supply-chain guards installed by this kit",
            ].map((item) => (
              <div key={item} className="border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#475569] leading-relaxed">
                {item}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      eyebrow: "The rhythm",
      title: "Bookends",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            The system stays alive through small, repeatable bookends. There are
            two layers:
          </p>
          <div className="space-y-3">
            <div className="bg-[#F1F5F9] rounded-xl p-4">
              <p className="font-semibold text-sm">Your day</p>
              <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">/morning</code>{" "}
                orients you and sets a couple of priorities.{" "}
                <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">/shutdown</code>{" "}
                closes the loop and captures what happened.
              </p>
            </div>
            <div className="bg-[#F1F5F9] rounded-xl p-4">
              <p className="font-semibold text-sm">Your work sessions</p>
              <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">/letsgo</code>{" "}
                loads context at the start of a session.{" "}
                <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">/handoff</code>{" "}
                writes a clean summary at the end so the next session picks up
                where you left off.
              </p>
            </div>
          </div>
          <p className="text-[#475569] leading-relaxed">
            These rituals distribute your new context into your external
            brain automatically, in real time.
          </p>
          <div className="bg-[#DCFCE7]/50 border border-[#16A34A]/20 rounded-xl p-4">
            <p className="text-[#475569] text-sm leading-relaxed">
              <strong className="text-[#16A34A]">Missing one is fine.</strong> Skip
              a morning, forget a shutdown — nothing falls apart. The more work
              you route through the system, the more your brain grows and the
              better it gets. Bryan sometimes does easy things through his
              system just so it knows they happened.
            </p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: "New this week",
      title: "Remote Control",
      body: (
        <div className="space-y-4">
          <p className="text-[#475569] leading-relaxed">
            &ldquo;I&apos;ve been loving this for the past couple weeks.&rdquo;
            Setup bakes in the config to start Remote Control every session,
            so you can drive Claude Code from your phone.
          </p>
          <p className="text-[#475569] leading-relaxed">A few realities:</p>
          <div className="space-y-2">
            {[
              "Your computer must be ON — the protocol is leave it plugged in, set it to not sleep while plugged in. Lid closed is fine.",
              "Sessions MUST be started from your computer — the phone app (Claude app → Code) controls sessions, it can't start them.",
              "Think ahead about when you'll be away, and start what you need before you leave.",
            ].map((item) => (
              <div key={item} className="bg-[#F1F5F9] rounded-xl p-4 text-sm text-[#475569] leading-relaxed">
                {item}
              </div>
            ))}
          </div>
          <p className="text-[#94A3B8] text-sm leading-relaxed">
            Always-on servers are a thing Bryan might explore someday. Not now.
          </p>
        </div>
      ),
    },
  ];

  const isLast = panel === panels.length - 1;
  const current = panels[panel];

  return (
    <div className="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full pt-4">
      <div className="flex gap-1.5 mb-8">
        {panels.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === panel ? "w-8 bg-[#16A34A]" : "w-1.5 bg-[#E2E8F0]"
            }`}
          />
        ))}
      </div>

      <div className="w-full flex-1">
        <p className="text-[#94A3B8] text-sm font-medium tracking-wide uppercase mb-2">
          {current.eyebrow}
        </p>
        <h2 className="text-3xl font-bold tracking-tight mb-6">
          {current.title}
        </h2>
        {current.body}
      </div>

      <div className="w-full flex items-center justify-between pt-8 mt-8 border-t border-[#E2E8F0]">
        <button
          onClick={() => (panel === 0 ? onBack() : setPanel((p) => p - 1))}
          className="text-[#475569] hover:text-[#1A1A1A] transition-colors text-sm font-medium"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-4">
          {!isLast && (
            <button
              onClick={onNext}
              className="text-[#94A3B8] hover:text-[#475569] transition-colors text-sm font-medium"
            >
              Skip intro
            </button>
          )}
          <button
            onClick={() => (isLast ? onNext() : setPanel((p) => p + 1))}
            className="bg-[#16A34A] text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-[#15803D] transition-colors"
          >
            {isLast ? "Start setup" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlatformStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: {
    id: "mac" | "pc";
    name: string;
    detail: string;
  }[] = [
    {
      id: "mac",
      name: "Mac",
      detail:
        "macOS. We'll use Ghostty as your terminal and install everything with Homebrew.",
    },
    {
      id: "pc",
      name: "PC",
      detail:
        "Windows 10 or 11. We'll set you up with Windows Terminal running Linux (WSL2) underneath, so your system behaves the same way as it does on a Mac.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        First things first
      </h1>
      <p className="text-[#475569] text-lg mb-10">
        Are you on a PC or a Mac? This decides how we set everything up, so it
        matters more than anything else you&apos;ll pick.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full mb-8">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setConfig({ ...config, platform: opt.id })}
            className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 cursor-pointer transition-all ${
              config.platform === opt.id
                ? "border-[#16A34A] bg-[#DCFCE7]/40"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <p className="text-2xl font-bold mb-2">{opt.name}</p>
            <p className="text-[#475569] text-sm leading-relaxed">
              {opt.detail}
            </p>
          </button>
        ))}
      </div>

      <p className="text-[#94A3B8] text-sm mb-8 max-w-md">
        Not sure? On a Mac the menu bar has an apple logo in the top-left
        corner. On a PC there&apos;s a Windows logo on the taskbar at the bottom.
      </p>

      <div className="flex items-center gap-6">
        <button
          onClick={onBack}
          className="text-[#475569] hover:text-[#1A1A1A] transition-colors text-sm font-medium"
        >
          &larr; Back
        </button>
        <button
          onClick={onNext}
          disabled={!config.platform}
          className={`px-10 py-4 rounded-lg font-semibold text-lg transition-colors ${
            config.platform
              ? "bg-[#16A34A] text-white hover:bg-[#15803D]"
              : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function PermissionsStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: {
    id: UserConfig["permissionMode"];
    name: string;
    recommended?: boolean;
    desc: string;
    detail: string;
  }[] = [
    {
      id: "auto",
      name: "Auto",
      recommended: true,
      desc: "A balanced starting allow-set, then learn-as-you-go. Reading files, searching the vault, and running safe commands are pre-approved; Claude asks the first time for anything else and remembers your answer.",
      detail:
        "Most things happen smoothly. Claude only interrupts for genuinely significant operations — deleting files, pushing code, or reaching a new service. It eliminates the fatigue of constant prompts while keeping you in control of what matters. The recommended default for almost everyone.",
    },
    {
      id: "restrictive",
      name: "Restrictive",
      desc: "A locked allow-set. Only the safest read-only actions are pre-approved; Claude asks before almost everything else, every time.",
      detail:
        "Maximum control, but you'll see a lot of prompts — especially early on when everything is new. This can lead to approving things you don't fully understand just to keep moving. If you choose this and find it overwhelming, you can switch to Auto later.",
    },
    {
      id: "permissive",
      name: "Permissive",
      desc: "A wide allow-set. File edits, terminal commands, and most tool access run without interruption.",
      detail:
        "Fast and frictionless, but you're trusting Claude to make good decisions about file changes, terminal commands, and tool access. Best for experienced users who understand what Claude Code does under the hood. Genuinely destructive operations are still blocked.",
    },
  ];

  return (
    <StepShell
      step={1}
      title="How should Claude ask for permission?"
      subtitle="Claude Code can read files, run terminal commands, and access tools on your behalf. This setting controls how much it checks with you first."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-3">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`block p-5 rounded-xl border cursor-pointer transition-all ${
              config.permissionMode === opt.id
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="permissionMode"
                checked={config.permissionMode === opt.id}
                onChange={() =>
                  setConfig({ ...config, permissionMode: opt.id })
                }
                className="mt-1 w-4 h-4 accent-[#16A34A]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{opt.name}</p>
                  {opt.recommended && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A]">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-[#475569] text-sm mt-1">{opt.desc}</p>
                <p className="text-[#94A3B8] text-xs mt-2 leading-relaxed">
                  {opt.detail}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 bg-[#F1F5F9] rounded-xl p-5">
        <p className="text-sm text-[#475569] leading-relaxed">
          <strong>Regardless of which mode you choose,</strong> dangerous
          operations are always blocked — mass file deletion, force-pushing
          code, installing system packages, and privilege escalation all require
          explicit approval every time.
        </p>
        <p className="text-sm text-[#475569] leading-relaxed mt-3">
          <strong>Tip:</strong> If Claude ever asks for permission and you&apos;re
          not sure what it means, take a screenshot and ask Claude to explain
          it. That&apos;s a completely normal thing to do, especially early on.
        </p>
      </div>
    </StepShell>
  );
}

function TerminalStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const terminalName =
    config.platform === "pc"
      ? "Windows Terminal"
      : config.useOwnTerminal
        ? "your terminal"
        : "Ghostty";
  const subtitle =
    config.platform !== "pc" && config.useOwnTerminal
      ? "You're keeping your own terminal, so we won't touch its config. Just tell us whether you lean light or dark — it helps your assistant pick readable colors for anything it generates."
      : `Pick a color scheme for ${terminalName}. Everything else — pane layout, status indicators — gets configured automatically during setup.`;
  return (
    <StepShell
      step={2}
      title="Terminal theme"
      subtitle={subtitle}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-6">
        <div>
          <p className="font-medium text-sm mb-3">{terminalName} color theme</p>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map((theme) => (
              <label
                key={theme}
                className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer transition-all ${
                  config.terminalTheme === theme
                    ? "border-[#16A34A] bg-[#DCFCE7]/30"
                    : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  checked={config.terminalTheme === theme}
                  onChange={() =>
                    setConfig({ ...config, terminalTheme: theme })
                  }
                  className="sr-only"
                />
                <div
                  className={`w-full h-20 rounded-lg mb-2 flex items-end p-2 ${
                    theme === "light"
                      ? "bg-[#FAFAFA] border border-[#E2E8F0]"
                      : "bg-[#1E293B]"
                  }`}
                >
                  <div className="flex gap-1 w-full">
                    <div
                      className={`flex-1 h-8 rounded text-[8px] font-mono p-1 ${
                        theme === "light"
                          ? "bg-white border border-[#E2E8F0] text-[#1A1A1A]"
                          : "bg-[#0f172a] text-[#94A3B8]"
                      }`}
                    >
                      $ claude
                    </div>
                    <div
                      className={`flex-1 h-8 rounded opacity-55 text-[8px] font-mono p-1 ${
                        theme === "light"
                          ? "bg-[#B0B0B0] text-[#1A1A1A]"
                          : "bg-[#334155] text-[#64748b]"
                      }`}
                    >
                      $ claude
                    </div>
                  </div>
                </div>
                <p className="font-medium text-sm capitalize">{theme}</p>
                <p className="text-[#94A3B8] text-xs">
                  {theme === "light"
                    ? "High contrast, easy on tired eyes"
                    : "Traditional developer theme"}
                </p>
              </label>
            ))}
          </div>
        </div>

      </div>
    </StepShell>
  );
}

function NamingStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepShell
      step={3}
      title="Name your system"
      subtitle="This becomes your Obsidian vault directory, your project name, and the word you type to launch it. Pick something that feels right — you'll use it every day."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!config.systemName.trim() || !config.userName.trim()}
    >
      <div className="space-y-6">
        <div>
          <input
            type="text"
            value={config.systemName}
            onChange={(e) =>
              setConfig({
                ...config,
                systemName: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, ""),
              })
            }
            placeholder="e.g., nexus, atlas, beacon, forge"
            className="w-full px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A]"
          />
          {config.systemName && (
            <p className="text-[#94A3B8] text-sm mt-2">
              Your vault will live at{" "}
              <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded text-xs font-mono">
                ~/{config.systemName}/
              </code>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#475569] mb-2">
            Your name
          </label>
          <input
            type="text"
            value={config.userName}
            onChange={(e) => setConfig({ ...config, userName: e.target.value })}
            placeholder="First name"
            className="w-full px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A]"
          />
        </div>
      </div>
    </StepShell>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        // Inside a clickable <label>; prevent toggling the checkbox.
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      aria-label={copied ? "Copied to clipboard" : "Copy command"}
      className={`shrink-0 inline-flex items-center gap-1 px-2.5 rounded text-xs font-medium transition-colors ${
        copied
          ? "bg-[#16A34A] text-white"
          : "bg-[#334155] text-[#FAFAFA] hover:bg-[#475569]"
      }`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function PreflightStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isPc = config.platform === "pc";

  const ghosttyItem = {
    key: "ghostty" as const,
    name: "Ghostty",
    install: "brew install --cask ghostty",
    copyable: true,
    link: "https://ghostty.org",
    desc: "A fast, modern terminal with split panes. This is where you'll interact with Claude Code across multiple projects at once. Recommended if you don't already have a terminal you love.",
  };

  const macItems = [
    ...(config.useOwnTerminal ? [] : [ghosttyItem]),
    {
      key: "obsidian" as const,
      name: "Obsidian",
      install: "brew install --cask obsidian",
      copyable: true,
      link: "https://obsidian.md",
      desc: "Your knowledge vault. Free. Don't create a vault yet — the setup will handle that.",
    },
    {
      key: "node" as const,
      name: "Node.js",
      install: "brew install node",
      copyable: true,
      link: "https://nodejs.org",
      desc: "The runtime your tooling builds on. A few helpers (including the Google Workspace CLI) need it, so this goes early.",
    },
    {
      key: "claudeCode" as const,
      name: "Claude Code",
      install: "curl -fsSL https://claude.ai/install.sh | sh",
      copyable: true,
      link: "https://docs.anthropic.com/en/docs/claude-code",
      desc: "Your AI partner. This is the native installer — it drops the 'claude' binary in ~/.local/bin. After it finishes, run 'claude' once in any terminal to authenticate with your Anthropic account.",
    },
  ];

  const pcItems = [
    {
      key: "windowsTerminal" as const,
      name: "Windows Terminal",
      install: "Pre-installed on Windows 11 — open the Microsoft Store to update or to install it on Windows 10.",
      copyable: false,
      link: "https://learn.microsoft.com/en-us/windows/terminal/install",
      desc: "Your terminal. It's the modern Windows terminal with tabs and split panes — this is where you'll run Claude Code.",
    },
    {
      key: "wsl" as const,
      name: "WSL2 + Ubuntu",
      install: "wsl --install",
      copyable: true,
      link: "https://learn.microsoft.com/en-us/windows/wsl/install",
      desc: "Linux running inside Windows. Open Windows Terminal, run the command above as administrator, then restart. This keeps your system behaving like a Mac under the hood. (Your installer will help with this.)",
    },
    {
      key: "obsidian" as const,
      name: "Obsidian",
      install: "Download the Windows installer from obsidian.md",
      copyable: false,
      link: "https://obsidian.md",
      desc: "Your knowledge vault. Free. Don't create a vault yet — the setup will handle that.",
    },
    {
      key: "node" as const,
      name: "Node.js (via nvm)",
      install:
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && source ~/.bashrc && nvm install --lts",
      copyable: true,
      link: "https://github.com/nvm-sh/nvm",
      desc: "Run this inside Ubuntu (WSL). nvm installs Node into your home directory, which sidesteps the permission errors a system-wide install hits. Claude Code needs Node, so this goes first.",
    },
    {
      key: "claudeCode" as const,
      name: "Claude Code",
      install: "curl -fsSL https://claude.ai/install.sh | sh",
      copyable: true,
      link: "https://docs.anthropic.com/en/docs/claude-code",
      desc: "Your AI partner. Run this native installer inside Ubuntu (WSL), then run 'claude' once to authenticate with your Anthropic account.",
    },
  ];

  const items = isPc ? pcItems : macItems;
  const allChecked = items.every((item) => config.preflight[item.key]);

  return (
    <StepShell
      step={0}
      title="Install the tools"
      subtitle={
        isPc
          ? "Here's what we'll get installed on your PC. Check each one off as you go — your installer can walk you through any of these."
          : "You need three things installed before we continue. Check each one off as you go."
      }
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!allChecked}
      nextLabel="All installed — continue"
    >
      {!isPc && (
        <label className="flex items-start gap-3 p-4 mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer">
          <input
            type="checkbox"
            checked={config.useOwnTerminal}
            onChange={(e) =>
              setConfig({
                ...config,
                useOwnTerminal: e.target.checked,
                preflight: {
                  ...config.preflight,
                  ownTerminal: e.target.checked,
                  // Don't let a stale Ghostty check block the now-shorter list.
                  ghostty: e.target.checked ? false : config.preflight.ghostty,
                },
              })
            }
            className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
          />
          <div>
            <p className="font-medium text-sm">
              I already have a terminal I like
            </p>
            <p className="text-[#94A3B8] text-sm mt-1 leading-relaxed">
              Skip Ghostty and use your own (iTerm2, Warp, Terminal.app, etc.).
              Everything works the same; you&apos;ll just configure split panes
              and themes your own way.
            </p>
          </div>
        </label>
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <label
            key={item.key}
            className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
              config.preflight[item.key]
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <input
              type="checkbox"
              checked={config.preflight[item.key]}
              onChange={(e) =>
                setConfig({
                  ...config,
                  preflight: {
                    ...config.preflight,
                    [item.key]: e.target.checked,
                  },
                })
              }
              className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{item.name}</p>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#16A34A] text-xs hover:underline"
                >
                  docs &nearr;
                </a>
              </div>
              <p className="text-[#475569] text-sm mt-1">{item.desc}</p>
              <div className="mt-2 flex items-stretch gap-2">
                <code className="flex-1 min-w-0 bg-[#1E293B] text-[#FAFAFA] text-xs px-3 py-1.5 rounded font-mono break-all flex items-center">
                  {item.install}
                </code>
                {item.copyable && <CopyButton text={item.install} />}
              </div>
            </div>
          </label>
        ))}
      </div>

      {!isPc && (
        <div className="mt-5 bg-[#F1F5F9] rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold">One more thing for the helpers</p>
          <p className="text-sm text-[#475569] leading-relaxed">
            A couple of behind-the-scenes tools need <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">jq</code> (a
            JSON utility). Install it now so setup doesn&apos;t stall later:
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 bg-[#1E293B] text-[#FAFAFA] text-xs px-3 py-1.5 rounded font-mono break-all flex items-center">
              brew install jq
            </code>
            <CopyButton text="brew install jq" />
          </div>
          <p className="text-sm text-[#475569] leading-relaxed pt-1">
            The Claude Code installer puts the <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">claude</code> command
            in <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">~/.local/bin</code>. If your terminal says
            &ldquo;command not found&rdquo; after installing, add that folder to your
            PATH (your assistant will do this for you in the first setup session):
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 bg-[#1E293B] text-[#FAFAFA] text-xs px-3 py-1.5 rounded font-mono break-all flex items-center">
              echo &apos;export PATH=&quot;$HOME/.local/bin:$PATH&quot;&apos; &gt;&gt; ~/.zshrc
            </code>
            <CopyButton text={`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`} />
          </div>
        </div>
      )}
    </StepShell>
  );
}

function AccountsStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const addAccount = () =>
    setConfig({
      ...config,
      googleAccounts: [
        ...config.googleAccounts,
        {
          email: "",
          label: "",
          accountType: "personal",
          corporateWorkspace: false,
          useForEmail: true,
          useForCalendar: true,
        },
      ],
    });

  const updateAccount = (
    i: number,
    field: "email" | "label",
    val: string,
  ) => {
    const updated = [...config.googleAccounts];
    updated[i] = { ...updated[i], [field]: val };
    setConfig({ ...config, googleAccounts: updated });
  };

  const updateAccountType = (i: number, val: "personal" | "workspace") => {
    const updated = [...config.googleAccounts];
    updated[i] = {
      ...updated[i],
      accountType: val,
      corporateWorkspace: val === "workspace",
    };
    setConfig({ ...config, googleAccounts: updated });
  };

  const updateAccountUse = (
    i: number,
    field: "useForEmail" | "useForCalendar",
    val: boolean,
  ) => {
    const updated = [...config.googleAccounts];
    updated[i] = { ...updated[i], [field]: val };
    setConfig({ ...config, googleAccounts: updated });
  };

  const emailCount = config.googleAccounts.filter(
    (a) => a.email && a.useForEmail,
  ).length;
  const calendarCount = config.googleAccounts.filter(
    (a) => a.email && a.useForCalendar,
  ).length;

  const hasWorkspace = config.googleAccounts.some(
    (a) => a.accountType === "workspace",
  );

  const removeAccount = (i: number) => {
    if (config.googleAccounts.length <= 1) return;
    setConfig({
      ...config,
      googleAccounts: config.googleAccounts.filter((_, idx) => idx !== i),
    });
  };

  return (
    <StepShell
      step={4}
      title="Google accounts"
      subtitle="Which Google accounts should your system connect to? We'll set up Gmail, Calendar, and Drive access for each one."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!config.googleAccounts[0]?.email.includes("@")}
    >
      <div className="space-y-6">
        <div className="space-y-4">
          {config.googleAccounts.map((acc, i) => (
            <div
              key={i}
              className="border border-[#E2E8F0] rounded-xl p-4 space-y-3 bg-white"
            >
              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={acc.email}
                  onChange={(e) => updateAccount(i, "email", e.target.value)}
                  placeholder="you@gmail.com"
                  className="flex-1 px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] font-mono text-sm"
                />
                <input
                  type="text"
                  value={acc.label}
                  onChange={(e) => updateAccount(i, "label", e.target.value)}
                  placeholder="Label (e.g., Work)"
                  className="w-40 px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] text-sm"
                />
                {config.googleAccounts.length > 1 && (
                  <button
                    onClick={() => removeAccount(i)}
                    className="text-[#94A3B8] hover:text-red-500 text-lg shrink-0"
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {(
                  [
                    { id: "personal" as const, label: "Personal Gmail" },
                    { id: "workspace" as const, label: "Company Workspace" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateAccountType(i, opt.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      acc.accountType === opt.id
                        ? "border-[#16A34A] bg-[#DCFCE7]/40 text-[#16A34A]"
                        : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#94A3B8]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acc.useForEmail}
                    onChange={(e) =>
                      updateAccountUse(i, "useForEmail", e.target.checked)
                    }
                    className="w-4 h-4 rounded accent-[#16A34A]"
                  />
                  Use for email
                </label>
                <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acc.useForCalendar}
                    onChange={(e) =>
                      updateAccountUse(i, "useForCalendar", e.target.checked)
                    }
                    className="w-4 h-4 rounded accent-[#16A34A]"
                  />
                  Use for calendar
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={addAccount}
            className="text-[#16A34A] text-sm font-medium hover:underline"
          >
            + Add another account
          </button>
          <p className="text-[#94A3B8] text-xs">
            {emailCount} email · {calendarCount} calendar
          </p>
        </div>

        <p className="text-[#94A3B8] text-xs leading-relaxed">
          Per-account aliases and sign-in get finished in the terminal during
          setup — this is just which accounts, and what they&apos;re for.
        </p>

        {hasWorkspace && (
          <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl p-5">
            <p className="font-semibold text-sm text-[#854D0E] mb-2">
              Heads up about company Workspace accounts
            </p>
            <p className="text-sm text-[#854D0E] leading-relaxed">
              Some organizations block self-created Google Cloud projects or
              unverified app access. If you hit an &ldquo;Access blocked / blocked
              by your administrator&rdquo; screen during setup, that&apos;s an org
              policy, not a broken install. Your assistant will walk you through
              the options: sign in to the corporate address through a personal
              Google Cloud project as a test user, ask your Workspace admin to
              allow-list the app, or connect that account through the Google MCP
              connector instead. Personal Gmail accounts almost never hit this.
            </p>
          </div>
        )}

        <div className="border-t border-[#E2E8F0] pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.businessPersonalSplit}
              onChange={(e) =>
                setConfig({
                  ...config,
                  businessPersonalSplit: e.target.checked,
                })
              }
              className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
            />
            <div>
              <p className="font-medium text-sm">
                I need to keep business and personal contexts separate
              </p>
              <p className="text-[#94A3B8] text-sm mt-1">
                Claude Code currently uses a single config directory. We&apos;ll set
                up project-level separation so your work and personal contexts
                don&apos;t bleed into each other.
              </p>
            </div>
          </label>
        </div>

        <p className="text-[#94A3B8] text-xs leading-relaxed">
          Under the hood, Gmail, Calendar, and Drive run through the Google
          Workspace CLI (<code className="bg-[#F1F5F9] px-1 py-0.5 rounded font-mono">gws</code>),
          installed during setup. It&apos;s the primary path; the Google MCP
          connector is a fallback only for admin-locked Workspace domains.
        </p>
      </div>
    </StepShell>
  );
}

function GitHubStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepShell
      step={5}
      title="GitHub"
      subtitle="Effectively required — it's the backup rail for everything this kit builds."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={config.github.hasAccount && !config.github.username.trim()}
    >
      <div className="space-y-6">
        <div className="bg-[#1E293B] rounded-xl p-6 space-y-3">
          <p className="text-[#FAFAFA]/90 text-sm leading-relaxed">
            &ldquo;I use GitHub for two things: backing my whole system up off
            my machine every night, and hosting the web projects I build.
            Here&apos;s the thing &mdash; I don&apos;t operate git myself. My
            agent does. That&apos;s the model for every tool in this system you
            don&apos;t deeply understand: your agent is the operator,
            you&apos;re the director.&rdquo;
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[#475569]">What it gives you</p>
          {[
            "If your laptop dies, your brain survives.",
            "A time machine — every day's state of your vault is recoverable.",
            "It's how this kit and your future projects ship.",
          ].map((item, i) => (
            <div key={item} className="flex gap-3 items-start bg-[#F1F5F9] rounded-xl p-3">
              <p className="font-bold text-[#16A34A] text-sm leading-none mt-0.5">{i + 1}</p>
              <p className="text-[#475569] text-sm leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl p-4">
          <p className="text-[#854D0E] text-sm leading-relaxed">
            <strong>Non-negotiable: vault repos are PRIVATE.</strong> This is
            your life. The setup creates private repos by default.
          </p>
        </div>

        <div className="border-t border-[#E2E8F0] pt-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.github.hasAccount}
              onChange={(e) =>
                setConfig({
                  ...config,
                  github: { ...config.github, hasAccount: e.target.checked },
                })
              }
              className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
            />
            <p className="font-medium text-sm">I already have a GitHub account</p>
          </label>

          {config.github.hasAccount ? (
            <input
              type="text"
              value={config.github.username}
              onChange={(e) =>
                setConfig({
                  ...config,
                  github: { ...config.github, username: e.target.value },
                })
              }
              placeholder="Your GitHub username"
              className="w-full px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] font-mono text-sm"
            />
          ) : (
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              No problem — creating a free account (github.com) is one of the
              first things setup will walk you through.
            </p>
          )}
        </div>
      </div>
    </StepShell>
  );
}

function TaskSystemStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: { id: UserConfig["taskSystem"]; name: string; desc: string }[] = [
    {
      id: "google-tasks",
      name: "Google Tasks",
      desc: "Works, but the API is limited — no priorities, no labels, no server-side filters, no recurring tasks via API. We'll build a CLI wrapper that compensates, but you're starting with a thinner foundation than Todoist. Choose this if staying inside Google matters more than task power.",
    },
    {
      id: "todoist",
      name: "Todoist (Recommended)",
      desc: "The same integration Bryan uses. Rich filter queries, priorities, labels, sections, recurring tasks, assignees — all via API. The most capable option for a system that queries your tasks programmatically.",
    },
    {
      id: "other",
      name: "Something else",
      desc: "We'll note your preference and the setup skill will help you integrate it.",
    },
  ];

  return (
    <StepShell
      step={6}
      title="Task system"
      subtitle="Your system needs a task source of truth — the place where 'what I need to do' lives. Which do you use? (Required — every option here works.)"
      onNext={onNext}
      onBack={onBack}
    >
      <div className="bg-[#F1F5F9] rounded-xl p-4 mb-4">
        <p className="text-[#475569] text-sm leading-relaxed">
          <strong className="text-[#1A1A1A]">The doctrine:</strong> your task
          manager holds dated commitments only &mdash; things you said
          you&apos;d do by a date. Everything else (the backlog) lives in your
          knowledge base. The date, not the project, is the organizing
          principle.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`block p-4 rounded-xl border cursor-pointer transition-all ${
              config.taskSystem === opt.id
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="taskSystem"
                checked={config.taskSystem === opt.id}
                onChange={() => setConfig({ ...config, taskSystem: opt.id })}
                className="w-4 h-4 accent-[#16A34A]"
              />
              <div>
                <p className="font-semibold text-sm">{opt.name}</p>
                <p className="text-[#475569] text-sm mt-0.5">{opt.desc}</p>
              </div>
            </div>
          </label>
        ))}

        {config.taskSystem === "other" && (
          <input
            type="text"
            value={config.taskSystemOther || ""}
            onChange={(e) =>
              setConfig({ ...config, taskSystemOther: e.target.value })
            }
            placeholder="What do you use?"
            className="w-full px-4 py-3 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] mt-2"
          />
        )}
      </div>
    </StepShell>
  );
}

function DictationStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepShell
      step={7}
      title="Dictation"
      subtitle="Optional, but the people who lean on dictation get far more out of the system than the people who type. Pick one, or skip for now."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-3">
        {DICTATION_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`block p-4 rounded-xl border cursor-pointer transition-all ${
              config.dictation.choice === opt.id
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="dictation"
                checked={config.dictation.choice === opt.id}
                onChange={() =>
                  setConfig({ ...config, dictation: { choice: opt.id } })
                }
                className="mt-1 w-4 h-4 accent-[#16A34A]"
              />
              <div>
                <p className="font-semibold text-sm">{opt.name}</p>
                <p className="text-[#16A34A] text-xs font-medium mt-0.5">
                  {opt.price}
                </p>
                <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            </div>
          </label>
        ))}

        <label
          className={`block p-4 rounded-xl border cursor-pointer transition-all ${
            config.dictation.choice === "other"
              ? "border-[#16A34A] bg-[#DCFCE7]/30"
              : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
          }`}
        >
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="dictation"
              checked={config.dictation.choice === "other"}
              onChange={() =>
                setConfig({ ...config, dictation: { choice: "other", other: config.dictation.other } })
              }
              className="w-4 h-4 accent-[#16A34A]"
            />
            <p className="font-semibold text-sm">Something else</p>
          </div>
          {config.dictation.choice === "other" && (
            <input
              type="text"
              value={config.dictation.other || ""}
              onChange={(e) =>
                setConfig({
                  ...config,
                  dictation: { choice: "other", other: e.target.value },
                })
              }
              placeholder="What do you use?"
              className="w-full mt-3 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] text-sm"
            />
          )}
        </label>

        <label
          className={`block p-4 rounded-xl border cursor-pointer transition-all ${
            config.dictation.choice === "skip"
              ? "border-[#16A34A] bg-[#DCFCE7]/30"
              : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
          }`}
        >
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="dictation"
              checked={config.dictation.choice === "skip"}
              onChange={() =>
                setConfig({ ...config, dictation: { choice: "skip" } })
              }
              className="w-4 h-4 accent-[#16A34A]"
            />
            <div>
              <p className="font-semibold text-sm">Not now</p>
              <p className="text-[#94A3B8] text-xs mt-0.5">
                Type for now — you can add dictation any time later.
              </p>
            </div>
          </div>
        </label>
      </div>
    </StepShell>
  );
}

function FinancialStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: { id: UserConfig["financialInterest"]; name: string }[] = [
    { id: "yes", name: "Yes, connect what I can" },
    { id: "no", name: "No — keep finances out of this system" },
    { id: "later", name: "Not sure yet — decide during setup" },
  ];

  return (
    <StepShell
      step={8}
      title="Financial tools"
      subtitle=""
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-6">
        <div className="bg-[#F1F5F9] rounded-xl p-5 text-sm leading-relaxed text-[#475569]">
          <p>
            &ldquo;I use read-only budgeting tools with zero spending capacity
            (FreshBooks for business, YNAB for personal). Whether you connect
            anything depends on your tools and your risk tolerance. The kit
            doesn&apos;t automate money &mdash; it just can see what you
            choose to show it.&rdquo;
          </p>
        </div>

        <div className="space-y-3">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                config.financialInterest === opt.id
                  ? "border-[#16A34A] bg-[#DCFCE7]/30"
                  : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="financialInterest"
                  checked={config.financialInterest === opt.id}
                  onChange={() =>
                    setConfig({ ...config, financialInterest: opt.id })
                  }
                  className="w-4 h-4 accent-[#16A34A]"
                />
                <p className="font-semibold text-sm">{opt.name}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </StepShell>
  );
}

function SkillsStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const toggle = (id: string) =>
    setConfig({
      ...config,
      optionalSkills: {
        ...config.optionalSkills,
        [id]: !config.optionalSkills[id],
      },
    });

  return (
    <StepShell
      step={9}
      title="Optional skills"
      subtitle="Core skills install automatically. These are extras — each one was built to solve a specific problem. Pick what fits your workflow."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-3 p-3 bg-[#F1F5F9] rounded-lg flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <p className="text-sm">
              <span className="font-medium">User-invoked</span>{" "}
              <span className="text-[#94A3B8]">&mdash; you run it</span>
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-sm">
              <span className="font-medium">System-invoked</span>{" "}
              <span className="text-[#94A3B8]">&mdash; fires automatically</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {OPTIONAL_SKILLS.map((skill) => (
          <label
            key={skill.id}
            className={`block p-4 rounded-xl border cursor-pointer transition-all ${
              config.optionalSkills[skill.id]
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!config.optionalSkills[skill.id]}
                onChange={() => toggle(skill.id)}
                className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{skill.name}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                      (skill.invokeType as string) === "user"
                        ? "bg-[#DCFCE7] text-[#16A34A]"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {skill.invokeType}
                  </span>
                </div>
                <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                  {skill.description}
                </p>
                {"note" in skill && skill.note && (
                  <div className="mt-2 flex items-start gap-2 bg-[#FEF9C3] border border-[#FDE68A] rounded-lg p-2.5">
                    <span className="text-[#A16207] text-sm leading-none mt-0.5">⚠</span>
                    <p className="text-[#854D0E] text-xs leading-relaxed">
                      {skill.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </StepShell>
  );
}

function DeferredModulesStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const modules: {
    id: keyof UserConfig["interestedModules"];
    name: string;
    desc: string;
  }[] = [
    {
      id: "emailSentinel",
      name: "Email sentinel",
      desc: "An agent that watches your inboxes every 15 minutes and pages you only for what genuinely can't wait, per rules YOU write. I built this yesterday. It paged me correctly the first day. I want a week on it before you get it.",
    },
    {
      id: "notifications",
      name: "Notifications",
      desc: "The system texts your phone when something needs you (Mac + iMessage). Same deal: brand new, want a week.",
    },
  ];

  const toggle = (id: keyof UserConfig["interestedModules"]) =>
    setConfig({
      ...config,
      interestedModules: {
        ...config.interestedModules,
        [id]: !config.interestedModules[id],
      },
    });

  return (
    <StepShell
      step={10}
      title="Coming in your first update"
      subtitle="I ship improvements as update documents your system applies itself — you're also testing THAT pipeline. Flag what you want first."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-3">
        {modules.map((mod) => (
          <label
            key={mod.id}
            className={`block p-4 rounded-xl border cursor-pointer transition-all ${
              config.interestedModules[mod.id]
                ? "border-[#16A34A] bg-[#DCFCE7]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={config.interestedModules[mod.id]}
                onChange={() => toggle(mod.id)}
                className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
              />
              <div>
                <p className="font-semibold text-sm">{mod.name}</p>
                <p className="text-[#475569] text-sm mt-1 leading-relaxed">
                  {mod.desc}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </StepShell>
  );
}

function BucketsStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [custom, setCustom] = useState("");

  const toggleBucket = (name: string) => {
    if (config.buckets.includes(name)) {
      setConfig({
        ...config,
        buckets: config.buckets.filter((b) => b !== name),
      });
    } else {
      setConfig({ ...config, buckets: [...config.buckets, name] });
    }
  };

  const addCustom = () => {
    if (custom.trim() && !config.buckets.includes(custom.trim())) {
      setConfig({ ...config, buckets: [...config.buckets, custom.trim()] });
      setCustom("");
    }
  };

  return (
    <StepShell
      step={11}
      title="Life buckets"
      subtitle=""
      onNext={onNext}
      onBack={onBack}
      nextDisabled={config.buckets.length < 2}
      nextLabel={`Continue with ${config.buckets.length} bucket${config.buckets.length !== 1 ? "s" : ""}`}
    >
      <div className="space-y-6">
        <div className="bg-[#F1F5F9] rounded-xl p-5 space-y-3 text-sm leading-relaxed text-[#475569]">
          <p>
            Buckets are the top-level categories of your life — not individual projects.
            Think of them as containers. A <strong>&ldquo;Career&rdquo;</strong> bucket might hold
            multiple work projects inside it. A <strong>&ldquo;Finances&rdquo;</strong> bucket
            covers budgeting, taxes, investments — all in one place.
          </p>
          <p>
            Bryan&apos;s system has ~14 buckets spanning both professional responsibilities
            (consulting clients, business partnerships) and personal areas (health, family,
            learning). Your bucket structure should reflect how <em>you</em> think about
            your life — there&apos;s no right number.
          </p>
          <p>
            Each bucket gets a folder in your Obsidian vault with a living manifest that
            tracks its current state. Individual projects live inside their buckets, or as
            separate Claude Code projects that link back to the bucket.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {BUCKET_SUGGESTIONS.map((name) => (
            <button
              key={name}
              onClick={() => toggleBucket(name)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                config.buckets.includes(name)
                  ? "bg-[#16A34A] text-white"
                  : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Add a custom bucket"
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] text-sm"
          />
          <button
            onClick={addCustom}
            disabled={!custom.trim()}
            className="px-4 py-2.5 rounded-lg bg-[#1E293B] text-white text-sm font-medium hover:bg-[#334155] transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {config.buckets.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#475569] mb-2">
              Your buckets:
            </p>
            <div className="flex flex-wrap gap-2">
              {config.buckets.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 bg-[#DCFCE7] text-[#16A34A] px-3 py-1 rounded-full text-sm font-medium"
                >
                  {b}
                  <button
                    onClick={() => toggleBucket(b)}
                    className="hover:text-red-500"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function ContextSourcesStep({
  config,
  setConfig,
  onNext,
  onBack,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const toggle = (id: string) =>
    setConfig({
      ...config,
      contextSources: {
        ...config.contextSources,
        [id]: !config.contextSources[id],
      },
    });

  const selectedSources = CONTEXT_SOURCES.filter(
    (s) => config.contextSources[s.id]
  );

  return (
    <StepShell
      step={12}
      title="Populate your Obsidian vault"
      subtitle=""
      onNext={onNext}
      onBack={onBack}
      nextLabel={
        selectedSources.length > 0
          ? `Continue with ${selectedSources.length} source${selectedSources.length !== 1 ? "s" : ""}`
          : "Skip — I'll start fresh"
      }
    >
      <div className="space-y-6">
        <div className="bg-[#F1F5F9] rounded-xl p-5 space-y-3 text-sm leading-relaxed text-[#475569]">
          <p>
            An empty Obsidian vault with nice folders is still an empty vault.
            Your system becomes useful the moment it knows who you are, who you
            work with, and what you&apos;re responsible for.
          </p>
          <p>
            You already have this context — it&apos;s scattered across the tools
            you&apos;ve been using. Select where your existing context lives, and
            Claude will help you extract and import it during setup.
          </p>
        </div>

        <div className="space-y-3">
          {CONTEXT_SOURCES.map((source) => (
            <label
              key={source.id}
              className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                config.contextSources[source.id]
                  ? "border-[#16A34A] bg-[#DCFCE7]/30"
                  : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!config.contextSources[source.id]}
                  onChange={() => toggle(source.id)}
                  className="mt-1 w-5 h-5 rounded accent-[#16A34A]"
                />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{source.name}</p>
                  <p className="text-[#475569] text-sm mt-1">
                    {source.description}
                  </p>
                  {config.contextSources[source.id] && (
                    <div className="mt-3 bg-[#1E293B] rounded-lg p-3">
                      <p className="text-[#94A3B8] text-xs font-medium mb-1">
                        What to do before setup:
                      </p>
                      <p className="text-[#FAFAFA] text-xs leading-relaxed">
                        {source.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </StepShell>
  );
}

function ReviewStep({
  config,
  onNext,
  onBack,
}: {
  config: UserConfig;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedSkills = OPTIONAL_SKILLS.filter(
    (s) => config.optionalSkills[s.id]
  );

  return (
    <StepShell
      step={13}
      title="Review your setup"
      subtitle="Here's what we'll configure. You can go back and change anything."
      onNext={onNext}
      onBack={onBack}
      nextLabel="Generate my config"
    >
      <div className="space-y-4">
        {[
          { label: "Kit version", value: KIT_VERSION },
          { label: "Platform", value: config.platform === "pc" ? "PC (Windows)" : "Mac" },
          { label: "System name", value: config.systemName },
          { label: "Your name", value: config.userName },
          { label: "Timezone", value: config.timezone },
          {
            label: "Permissions",
            value:
              config.permissionMode === "auto"
                ? "Auto (recommended)"
                : config.permissionMode === "restrictive"
                  ? "Restrictive"
                  : "Permissive",
          },
          {
            label: "Terminal",
            value:
              config.platform === "pc"
                ? `Windows Terminal · ${config.terminalTheme === "light" ? "Light" : "Dark"}`
                : config.useOwnTerminal
                  ? `My own terminal · ${config.terminalTheme === "light" ? "Light" : "Dark"}`
                  : `Ghostty · ${config.terminalTheme === "light" ? "Light" : "Dark"}`,
          },
          {
            label: "Google accounts",
            value: config.googleAccounts
              .filter((a) => a.email)
              .map(
                (a) =>
                  `${a.email}${a.label ? ` (${a.label})` : ""} — ${
                    a.accountType === "workspace" ? "Workspace" : "Personal"
                  }`,
              )
              .join(", "),
          },
          {
            label: "Biz/personal split",
            value: config.businessPersonalSplit ? "Yes" : "No",
          },
          {
            label: "GitHub",
            value: config.github.hasAccount
              ? config.github.username || "Account, username not set"
              : "No account yet",
          },
          {
            label: "Task system",
            value:
              config.taskSystem === "other"
                ? config.taskSystemOther || "Other"
                : config.taskSystem === "google-tasks"
                  ? "Google Tasks"
                  : "Todoist",
          },
          {
            label: "Dictation",
            value:
              config.dictation.choice === "other"
                ? config.dictation.other || "Other"
                : config.dictation.choice === "skip"
                  ? "Not now"
                  : DICTATION_OPTIONS.find((o) => o.id === config.dictation.choice)
                      ?.name || "—",
          },
          {
            label: "Financial tools",
            value:
              config.financialInterest === "yes"
                ? "Interested"
                : config.financialInterest === "no"
                  ? "Keeping finances out"
                  : "Deciding during setup",
          },
          {
            label: "Optional skills",
            value:
              selectedSkills.length > 0
                ? selectedSkills.map((s) => s.name).join(", ")
                : "None selected",
          },
          {
            label: "Interested in",
            value:
              [
                config.interestedModules.emailSentinel && "Email sentinel",
                config.interestedModules.notifications && "Notifications",
              ]
                .filter(Boolean)
                .join(", ") || "Neither for now",
          },
          {
            label: "Life buckets",
            value: config.buckets.join(", "),
          },
          {
            label: "Context sources",
            value: (() => {
              const sources = CONTEXT_SOURCES.filter(
                (s) => config.contextSources[s.id]
              );
              return sources.length > 0
                ? sources.map((s) => s.name).join(", ")
                : "Starting fresh";
            })(),
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between py-3 border-b border-[#E2E8F0] last:border-0"
          >
            <p className="text-[#94A3B8] text-sm font-medium w-44 shrink-0">
              {row.label}
            </p>
            <p className="text-sm text-right">{row.value || "—"}</p>
          </div>
        ))}
      </div>
    </StepShell>
  );
}

function ExportStep({
  config,
  onBack,
}: {
  config: UserConfig;
  onBack: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);

  const configJson = JSON.stringify(config, null, 2);

  const download = useCallback(() => {
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-config.json";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }, [configJson]);

  return (
    <StepShell
      step={14}
      title="You're ready"
      subtitle="Your config is generated. Here's what to do next."
      onNext={() => {}}
      onBack={onBack}
      hideNext
    >
      <div className="space-y-6">
        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-1">
            What happens next
          </p>
          <p className="text-[#FAFAFA]/80 text-sm leading-relaxed">
            You&apos;ll download your config, then hand off to Claude Code. From
            there <span className="text-white font-medium">your assistant takes over</span> &mdash;
            it reads your config, builds your vault, connects your tools, and runs
            your first ritual with you. The seam below is the last thing you do by
            hand.
          </p>
        </div>

        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-3">
            Step 1 &mdash; Download your config
          </p>
          <button
            onClick={download}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
              downloaded
                ? "bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30"
                : "bg-[#16A34A] text-white hover:bg-[#15803D]"
            }`}
          >
            {downloaded
              ? "✓ Downloaded user-config.json"
              : "Download user-config.json"}
          </button>
          <p className="text-[#94A3B8] text-xs mt-3">
            Stamped with kit version{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[#FAFAFA]">
              {KIT_VERSION}
            </code>
            .
          </p>
        </div>

        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-3">
            Step 2 &mdash; Clone the installer and drop your config in
          </p>
          <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed text-[#FAFAFA] whitespace-pre-wrap break-all">
            <span className="text-[#94A3B8]">$</span> git clone https://github.com/bryanstealey/personal-os-starter.git ~/personal-os-installer
            {"\n"}
            <span className="text-[#94A3B8]">$</span> mv ~/Downloads/user-config.json ~/personal-os-installer/config/
          </code>
          <p className="text-[#94A3B8] text-xs mt-3">
            The installer lives in its own folder &mdash; separate from the vault
            it builds. Your vault gets created fresh at{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[#FAFAFA]">
              ~/{config.systemName || "your-system"}
            </code>{" "}
            during setup, with no leftover installer files inside it.
          </p>
        </div>

        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-3">
            Step 3 &mdash; Start Claude Code from the installer
          </p>
          <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono text-[#FAFAFA] whitespace-pre-wrap break-all">
            <span className="text-[#94A3B8]">$</span> cd ~/personal-os-installer && claude
          </code>
          <p className="text-[#94A3B8] text-xs mt-3">
            On first launch, Claude greets you by name, recaps what you&apos;ve
            configured, and continues straight into setup &mdash; installing
            skills, building your vault at{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[#FAFAFA]">
              ~/{config.systemName || "your-system"}
            </code>
            , connecting your tools, and creating your first project. No need to
            tell it what to do; it picks up from your config.
          </p>
        </div>

        <div className="bg-[#FEF9C3] rounded-xl p-6 border border-[#FDE68A]">
          <p className="font-semibold text-sm text-[#854D0E] mb-2">
            This is a test build ({KIT_VERSION})
          </p>
          <p className="text-[#854D0E] text-sm leading-relaxed">
            You&apos;re an early tester, so expect a rough edge or two. There&apos;s
            no auto-update yet &mdash; fixes get hand-delivered. If something
            breaks or feels off, note the kit version above and flag it; that
            tells us exactly which build you&apos;re on.
          </p>
        </div>

        <div className="bg-[#DCFCE7]/50 rounded-xl p-6 border border-[#16A34A]/20">
          <p className="font-semibold text-sm text-[#16A34A] mb-2">
            A note on security
          </p>
          <p className="text-[#475569] text-sm leading-relaxed">
            As you use Claude Code, you&apos;ll discover public skills and plugins
            you can install. Before adding any third-party skill, review its
            source code &mdash; look for unexpected network calls, file access
            patterns, or prompt injection attempts. Treat skills like npm
            packages: useful, but vet before you trust.
          </p>
        </div>
      </div>
    </StepShell>
  );
}

export default function Home() {
  const [step, setStep] = useState(-5);
  const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG);

  const next = () => {
    // Stamp startedAt the first time the user advances past Welcome. The
    // installer treats a non-null startedAt as "resume," not "fresh start."
    setConfig((c) => (c.startedAt ? c : { ...c, startedAt: new Date().toISOString() }));
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => s - 1);

  return (
    <main className="flex-1 flex flex-col px-6 py-8 sm:px-8 lg:px-12 min-h-screen">
      {step === -5 && (
        <DisclaimerStep config={config} setConfig={setConfig} onNext={next} />
      )}
      {step === -4 && (
        <CostGateStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === -3 && <WelcomeStep onNext={next} />}
      {step === -2 && <ConceptStep onNext={next} onBack={back} />}
      {step === -1 && (
        <PlatformStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 0 && (
        <PreflightStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 1 && (
        <PermissionsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <TerminalStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <NamingStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <AccountsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <GitHubStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 6 && (
        <TaskSystemStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 7 && (
        <DictationStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 8 && (
        <FinancialStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 9 && (
        <SkillsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 10 && (
        <DeferredModulesStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 11 && (
        <BucketsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 12 && (
        <ContextSourcesStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 13 && (
        <ReviewStep config={config} onNext={next} onBack={back} />
      )}
      {step === 14 && <ExportStep config={config} onBack={back} />}
    </main>
  );
}
