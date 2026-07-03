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
  // Bryan's posture is auto permission mode (explained on the How-it-works step);
  // it's no longer a user choice, but the field still exports for the installer.
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
  // Deferred modules are no longer chosen in the UI (Bryan announces them in his
  // send-out message), but the field stays in the export so downstream code that
  // reads it doesn't break.
  interestedModules: {
    emailSentinel: boolean;
    notifications: boolean;
  };
  buckets: string[];
  // Optional now — the terminal-phase interview gathers context sources live,
  // where the agent can reach the data itself. Exports as an empty object.
  contextSources?: Record<string, boolean>;
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
  taskSystem: "todoist",
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

const OPTIONAL_SKILLS = [
  {
    id: "x-reader",
    name: "X / Twitter Reader",
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
  {
    id: "excalidraw-diagram",
    name: "Excalidraw Diagrams",
    description:
      "Turns a workflow, architecture, or idea into a clean, editable Excalidraw diagram — for when a picture makes the argument better than a paragraph. You ask for one by name when you want it.",
    note: "Rendering a diagram to an image needs a one-time local setup (a small Python runner plus a headless browser). Your assistant can handle that the first time you use it.",
    invokeType: "user" as const,
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

// Welcome (0) is an unnumbered hero; Export (14) is an unnumbered completion.
// Steps 1–13 carry the numbered progress.
const NUMBERED_STEPS = 13;

/* ------------------------------------------------------------------ */
/* Shared UI                                                           */
/* ------------------------------------------------------------------ */

function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 ${className}`}
    >
      {children}
      <span aria-hidden className="text-[0.85em]">
        ↗
      </span>
    </a>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-coral text-white font-semibold rounded-lg transition-colors hover:bg-coral-deep disabled:bg-brand-tint disabled:text-white/70 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-ink-soft hover:text-ink transition-colors text-sm font-medium"
    >
      ← Back
    </button>
  );
}

function HeaderLogo() {
  return (
    <Image
      src="/images/morgantown-ai-on-light-logo.png"
      alt="Morgantown AI"
      width={600}
      height={150}
      priority
      className="h-9 w-auto"
    />
  );
}

// Frame for every numbered step: brand header, coral progress, title block, nav.
function StepFrame({
  current,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
  hideNext = false,
}: {
  current: number;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNext?: boolean;
}) {
  const pct = (current / NUMBERED_STEPS) * 100;
  return (
    <div className="flex-1 flex flex-col w-full">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <HeaderLogo />
          <p className="text-ink-soft text-sm font-medium">
            Step {current} of {NUMBERED_STEPS}
          </p>
        </div>
        <div className="h-1 w-full rounded-full bg-brand-tint/40 overflow-hidden mb-10">
          <div
            className="h-full rounded-full bg-coral transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-dark mb-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-ink-soft text-lg leading-relaxed mb-8">{subtitle}</p>
        )}
        <div className="mb-10">{children}</div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pt-6 border-t border-brand-tint/60">
        {onBack ? <BackLink onClick={onBack} /> : <div />}
        {!hideNext && (
          <PrimaryButton
            onClick={onNext}
            disabled={nextDisabled}
            className="px-8 py-3 text-sm"
          >
            {nextLabel}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

// Selectable option card — 1px tint border by default, 2px blue + faint wash when
// selected. Never green, never ambiguous.
function optionClass(selected: boolean) {
  return `block rounded-xl bg-card cursor-pointer transition-all ${
    selected
      ? "border-2 border-brand bg-brand-tint/35"
      : "border border-brand-tint hover:border-brand"
  }`;
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
          ? "bg-coral text-white"
          : "bg-slate-dark text-white/90 hover:bg-brand"
      }`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function CommandRow({ command }: { command: string }) {
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 bg-slate-dark text-white/90 text-xs px-3 py-1.5 rounded font-mono break-all flex items-center">
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 0 — Welcome                                                    */
/* ------------------------------------------------------------------ */

function WelcomeStep({
  config,
  setConfig,
  onNext,
}: {
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
}) {
  const proceed = () => {
    // Continuing past this page is the acknowledgment — there's no checkbox.
    setConfig({ ...config, alphaAcknowledged: true, costAcknowledged: true });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        <Image
          src="/images/morgantown-ai-on-light-logo.png"
          alt="Morgantown AI"
          width={600}
          height={150}
          priority
          className="h-14 w-auto mx-auto mb-10"
        />
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-dark">
          Cortex
        </h1>
        <p className="text-brand text-lg font-semibold tracking-tight mt-1">
          Personal Operating System
        </p>
        <p
          className="text-ink-soft text-lg leading-relaxed mt-5 max-w-xl mx-auto"
          style={{ textWrap: "balance" }}
        >
          A command center for your life, built on your computer and your actual
          tools. Built by Bryan Stealey &mdash; installed and driven by your own AI.
        </p>
      </div>

      <div className="w-full space-y-6 mt-10">
        {/* What you're about to do */}
        <p className="text-ink leading-relaxed">
          This works in <strong className="text-slate-dark">two phases</strong>.
          Phase one is this page, where you learn how the
          system thinks, tell it about your setup, and generate your personal
          config. Phase two happens in your terminal: Claude Code reads that config
          and drives the install from a runbook, step by step. By the end you have
          a working vault seeded with your real context and an AI partner that
          actually knows your system.
        </p>

        {/* Alpha block — calm, not scary */}
        <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-6">
          <p className="text-brand text-xs font-semibold uppercase tracking-wider mb-2">
            An alpha, plainly
          </p>
          <p className="text-ink leading-relaxed">
            If you&apos;re seeing this, you&apos;re testing it &mdash; I want any
            and all feedback. AI agents aren&apos;t perfect and nobody fully knows
            what&apos;s up yet; something unexpected can always happen. Guardrails
            are installed everywhere I can put them, and everything the install
            changes on your machine is reversible (there&apos;s an{" "}
            <ExternalLink
              href="https://github.com/bryanstealey/personal-os-starter/blob/main/UNINSTALL.md"
              className="text-brand font-medium underline underline-offset-2"
            >
              uninstall guide
            </ExternalLink>
            ). Installing means you&apos;re comfortable with that risk.
          </p>
        </div>

        {/* Cost block — informational fact strip, NOT a plan picker */}
        <div className="rounded-xl border border-brand-tint bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-tint/60">
            <p className="text-slate-dark text-sm font-semibold">
              What it costs to run
            </p>
            <p className="text-ink-soft text-sm mt-0.5">
              You need a paid Claude plan. This is just so you know before you
              start &mdash; nothing to choose here.
            </p>
          </div>
          <div className="divide-y divide-brand-tint/50">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-6 py-4">
              <p className="sm:w-48 shrink-0 font-semibold text-slate-dark text-sm">
                Claude Pro{" "}
                <span className="text-ink-soft font-normal">$20/mo</span>
              </p>
              <p className="text-ink text-sm leading-relaxed">
                The minimum. Worth a shot at first, but probably not enough as a
                daily driver.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-6 py-4">
              <p className="sm:w-48 shrink-0 font-semibold text-slate-dark text-sm">
                Claude Max{" "}
                <span className="text-ink-soft font-normal">$100/mo</span>
              </p>
              <p className="text-ink text-sm leading-relaxed">
                I&apos;m a heavy user and I pretty much need this &mdash;
                when you move up, it&apos;s well worth it.
              </p>
            </div>
          </div>
          <div className="px-6 py-3 bg-paper border-t border-brand-tint/60">
            <p className="text-ink-soft text-xs leading-relaxed">
              Heavy moments &mdash; like the initial population of your knowledge
              base &mdash; burn limits fastest, and background agents share your
              account limits.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="w-full flex flex-col items-center mt-12">
        <PrimaryButton onClick={proceed} className="px-12 py-4 text-lg">
          Let&apos;s build it
        </PrimaryButton>
        <p className="text-ink-soft text-xs mt-3">
          Continuing means you&apos;ve read the alpha notice.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — How it works (philosophy panels)                          */
/* ------------------------------------------------------------------ */

function HowItWorksStep({
  current,
  onNext,
  onBack,
}: {
  current: number;
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
          <p className="text-ink leading-relaxed">
            Cortex is the original &mdash; the system Bryan built to run his life
            through a command center: everything he&apos;s responsible for, wants
            to do, wants to get better at.
          </p>
          <div className="bg-brand-tint/25 rounded-xl p-5">
            <p className="text-ink leading-relaxed">
              The strength is that it uses{" "}
              <strong className="text-slate-dark">YOUR</strong>{" "}computer and
              connects to <strong className="text-slate-dark">YOUR</strong>{" "}
              actual tools. You end up dictating to a staff.
            </p>
            <p className="text-ink leading-relaxed mt-3">
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
          <p className="text-ink leading-relaxed">
            High-level AI use comes down to two questions, every time:
          </p>
          <div className="space-y-3">
            <div className="border border-brand-tint rounded-xl p-4 flex gap-3">
              <p className="font-extrabold text-brand text-lg leading-none">1</p>
              <div>
                <p className="font-semibold text-sm text-slate-dark">
                  What&apos;s the context?
                </p>
                <p className="text-ink text-sm mt-1 leading-relaxed">
                  What exists on your computer and in your head that would help?
                </p>
              </div>
            </div>
            <div className="border border-brand-tint rounded-xl p-4 flex gap-3">
              <p className="font-extrabold text-brand text-lg leading-none">2</p>
              <div>
                <p className="font-semibold text-sm text-slate-dark">
                  What do you want?
                </p>
              </div>
            </div>
          </div>
          <div className="bg-brand-tint/25 rounded-xl p-4">
            <p className="text-ink leading-relaxed text-[15px]">
              This system exists to answer #1 permanently, so you only ever have
              to say #2.
            </p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: "The foundation",
      title: "Three essential tools",
      body: (
        <div className="space-y-4">
          <p className="text-ink leading-relaxed">
            Plenty of tools plug into a system like this over time. These three
            are the essential ones &mdash; the mandatory foundation everything
            else builds on:
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { name: "Claude Code", role: "Your AI partner" },
              { name: "Obsidian", role: "Your knowledge vault" },
              { name: "A task manager", role: "Your dated commitments" },
            ].map((tool) => (
              <div
                key={tool.name}
                className="border border-brand-tint rounded-xl p-4"
              >
                <p className="font-semibold text-sm text-slate-dark">
                  {tool.name}
                </p>
                <p className="text-ink-soft text-xs mt-1 leading-relaxed">
                  {tool.role}
                </p>
              </div>
            ))}
          </div>
          <p className="text-ink leading-relaxed">
            Everything in setup either installs one of these or connects something
            to them.
          </p>
        </div>
      ),
    },
    {
      eyebrow: "The posture",
      title: "Access = power",
      body: (
        <div className="space-y-4">
          <p className="text-ink leading-relaxed">
            The more you give your system access to, the more powerful it is. If
            you have to stay gated about information or tools, those are limiting
            factors. So my approach is to batten down every controllable risk in
            exchange for being aggressive with agents:
          </p>
          <p className="text-ink leading-relaxed">
            I run <strong className="text-slate-dark">auto permission mode</strong>,
            which keeps me in flow while still gating the most dangerous actions.
            Financial tools are read-only &mdash; nothing in this system can spend
            money. Backups go to private repos, always. And the kit installs
            supply-chain guards for the software it touches.
          </p>
        </div>
      ),
    },
    {
      eyebrow: "The rhythm",
      title: "Bookends",
      body: (
        <div className="space-y-4">
          <p className="text-ink leading-relaxed">
            The system stays alive through small, repeatable bookends. There are
            two layers:
          </p>
          <div className="space-y-3">
            <div className="bg-brand-tint/25 rounded-xl p-4">
              <p className="font-semibold text-sm text-slate-dark">Your day</p>
              <p className="text-ink text-sm mt-1 leading-relaxed">
                <code className="bg-card px-1.5 py-0.5 rounded text-xs font-mono">
                  /morning
                </code>{" "}
                orients you and sets a couple of priorities.{" "}
                <code className="bg-card px-1.5 py-0.5 rounded text-xs font-mono">
                  /shutdown
                </code>{" "}
                closes the loop and captures what happened.
              </p>
            </div>
            <div className="bg-brand-tint/25 rounded-xl p-4">
              <p className="font-semibold text-sm text-slate-dark">
                Your work sessions
              </p>
              <p className="text-ink text-sm mt-1 leading-relaxed">
                <code className="bg-card px-1.5 py-0.5 rounded text-xs font-mono">
                  /letsgo
                </code>{" "}
                loads context at the start of a session.{" "}
                <code className="bg-card px-1.5 py-0.5 rounded text-xs font-mono">
                  /handoff
                </code>{" "}
                writes a clean summary at the end so the next session picks up
                where you left off.
              </p>
            </div>
          </div>
          <div className="border border-brand-tint rounded-xl p-4">
            <p className="text-ink text-sm leading-relaxed">
              <strong className="text-slate-dark">Missing one is fine.</strong>{" "}
              Skip a morning, forget a shutdown &mdash; nothing falls apart. The
              more work you route through the system, the more your brain grows and
              the better it gets.
            </p>
          </div>
          <p className="text-ink leading-relaxed text-[15px]">
            <strong className="text-slate-dark">It compounds.</strong>{" "}Every note
            you capture, every project you add, every decision you log makes the
            system &mdash; and your assistant &mdash; a little sharper.
          </p>
        </div>
      ),
    },
    {
      eyebrow: "New this week",
      title: "Remote Control",
      body: (
        <div className="space-y-4">
          <p className="text-ink leading-relaxed">
            I&apos;ve been loving this for the past couple weeks.
            Setup bakes in the config to start Remote Control every session, so you
            can drive Claude Code from the Claude app on your phone. A few
            realities:
          </p>
          <div className="space-y-3">
            <div className="bg-brand-tint/25 rounded-xl p-4">
              <p className="text-ink text-sm leading-relaxed">
                <strong className="text-slate-dark">
                  Your computer must be on.
                </strong>{" "}
                My protocol: leave it plugged in, and set it to stay awake while
                plugged in &mdash; that&apos;s a setting, not the default, and
                setup will show you where it is (System Settings → Battery →
                Options → &ldquo;Prevent automatic sleeping on power
                adapter&rdquo;). With that set, lid closed is fine.
              </p>
            </div>
            <div className="bg-brand-tint/25 rounded-xl p-4">
              <p className="text-ink text-sm leading-relaxed">
                <strong className="text-slate-dark">
                  Sessions must be started from your computer.
                </strong>{" "}
                The phone app picks up running sessions &mdash; it can&apos;t start
                them. Think ahead about when you&apos;ll be away, and start what
                you need before you leave.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const isLast = panel === panels.length - 1;
  const current_ = panels[panel];
  const pct = (current / NUMBERED_STEPS) * 100;

  return (
    <div className="flex-1 flex flex-col w-full">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <HeaderLogo />
          <p className="text-ink-soft text-sm font-medium">
            Step {current} of {NUMBERED_STEPS}
          </p>
        </div>
        <div className="h-1 w-full rounded-full bg-brand-tint/40 overflow-hidden mb-10">
          <div
            className="h-full rounded-full bg-coral transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex-1">
        {/* Panel dots */}
        <div className="flex gap-1.5 mb-8">
          {panels.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === panel ? "w-8 bg-coral" : "w-1.5 bg-brand-tint"
              }`}
            />
          ))}
        </div>

        <p className="text-brand text-sm font-semibold tracking-wide uppercase mb-2">
          {current_.eyebrow}
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-dark mb-6">
          {current_.title}
        </h2>
        {current_.body}
      </div>

      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pt-8 mt-8 border-t border-brand-tint/60">
        <BackLink onClick={() => (panel === 0 ? onBack() : setPanel((p) => p - 1))} />
        <div className="flex items-center gap-4">
          {!isLast && (
            <button
              onClick={onNext}
              className="text-ink-soft hover:text-ink transition-colors text-sm font-medium"
            >
              Skip intro
            </button>
          )}
          <PrimaryButton
            onClick={() => (isLast ? onNext() : setPanel((p) => p + 1))}
            className="px-8 py-3 text-sm"
          >
            {isLast ? "Start setup" : "Next"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Platform                                                   */
/* ------------------------------------------------------------------ */

function PlatformStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: { id: "mac" | "pc"; name: string; detail: string }[] = [
    {
      id: "mac",
      name: "Mac",
      detail: "macOS — everything installs with Homebrew.",
    },
    {
      id: "pc",
      name: "PC",
      detail:
        "Windows 10 or 11. We'll set you up with Windows Terminal running Linux (WSL2) underneath, so your system behaves the same way it does on a Mac.",
    },
  ];

  return (
    <StepFrame
      current={current}
      title="Mac or PC?"
      subtitle="This decides how we set everything up, so it matters more than anything else you'll pick."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!config.platform}
    >
      <div className="grid grid-cols-2 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setConfig({ ...config, platform: opt.id })}
            className={`flex flex-col items-center text-center p-6 ${optionClass(
              config.platform === opt.id,
            )}`}
          >
            <p className="text-2xl font-bold text-slate-dark mb-2">{opt.name}</p>
            <p className="text-ink text-sm leading-relaxed">{opt.detail}</p>
          </button>
        ))}
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Terminal                                                   */
/* ------------------------------------------------------------------ */

function TerminalStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isPc = config.platform === "pc";

  const terminalName = isPc
    ? "Windows Terminal"
    : config.useOwnTerminal
      ? "your terminal"
      : "Ghostty";

  return (
    <StepFrame
      current={current}
      title="Your terminal"
      subtitle={
        isPc
          ? "On Windows, your system runs in Windows Terminal. Pick a theme below — everything else gets configured for you."
          : "This is where you'll run Claude Code. Pick the path that fits, then choose a theme."
      }
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-6">
        {!isPc && (
          <div className="grid gap-3">
            <button
              onClick={() => setConfig({ ...config, useOwnTerminal: false })}
              className={`text-left p-5 ${optionClass(!config.useOwnTerminal)}`}
            >
              <p className="font-semibold text-slate-dark">
                Ghostty &mdash; the accounted-for path
              </p>
              <p className="text-ink text-sm mt-1 leading-relaxed">
                This setup accounts for Ghostty &mdash; theme, config, shortcuts
                all handled. If you don&apos;t have a terminal you love, use this.
              </p>
            </button>
            <button
              onClick={() => setConfig({ ...config, useOwnTerminal: true })}
              className={`text-left p-5 ${optionClass(config.useOwnTerminal)}`}
            >
              <p className="font-semibold text-slate-dark">
                I already have a terminal
              </p>
              <p className="text-ink text-sm mt-1 leading-relaxed">
                Totally fine &mdash; just realize there may be some things you have
                to figure out that this setup doesn&apos;t account for (theming,
                config paths). The install itself works in any terminal.
              </p>
            </button>
          </div>
        )}

        <div>
          <p className="font-medium text-sm text-ink mb-3">
            {terminalName} color theme
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map((theme) => (
              <label
                key={theme}
                className={`flex flex-col items-center p-4 ${optionClass(
                  config.terminalTheme === theme,
                )}`}
              >
                <input
                  type="radio"
                  name="theme"
                  checked={config.terminalTheme === theme}
                  onChange={() => setConfig({ ...config, terminalTheme: theme })}
                  className="sr-only"
                />
                <div
                  className={`w-full h-20 rounded-lg mb-2 flex items-end p-2 ${
                    theme === "light"
                      ? "bg-paper border border-brand-tint"
                      : "bg-slate-dark"
                  }`}
                >
                  <div className="flex gap-1 w-full">
                    <div
                      className={`flex-1 h-8 rounded text-[8px] font-mono p-1 ${
                        theme === "light"
                          ? "bg-card border border-brand-tint text-slate-dark"
                          : "bg-[#0f172a] text-white/60"
                      }`}
                    >
                      $ claude
                    </div>
                    <div
                      className={`flex-1 h-8 rounded opacity-55 text-[8px] font-mono p-1 ${
                        theme === "light"
                          ? "bg-brand-tint text-slate-dark"
                          : "bg-[#334155] text-white/40"
                      }`}
                    >
                      $ claude
                    </div>
                  </div>
                </div>
                <p className="font-medium text-sm capitalize text-slate-dark">
                  {theme}
                </p>
                <p className="text-ink-soft text-xs">
                  {theme === "light"
                    ? "High contrast, easy on tired eyes"
                    : "Traditional developer theme"}
                </p>
              </label>
            ))}
          </div>
        </div>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Install the essential tools                               */
/* ------------------------------------------------------------------ */

function InstallStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
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
    desc: "A fast, modern terminal with split panes. This is where you'll interact with Claude Code across multiple projects at once.",
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
      install:
        "Pre-installed on Windows 11 — open the Microsoft Store to update or to install it on Windows 10.",
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
    <StepFrame
      current={current}
      title="Install the essential tools"
      subtitle={
        isPc
          ? "Here's what we'll get installed on your PC. Check each one off as you go — your installer can walk you through any of these."
          : "These are the essential tools your system runs on. Check each one off as you go."
      }
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!allChecked}
      nextLabel="All installed — continue"
    >
      {/* First-time terminal explainer */}
      <details className="group rounded-xl border border-brand-tint bg-card mb-6">
        <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-sm font-medium text-brand">
          Never used a terminal before? Read this first.
          <span className="text-ink-soft transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-ink leading-relaxed border-t border-brand-tint/50">
          <p>
            The terminal is just a text window where you type a command and press
            Return to run it. That&apos;s the whole thing. It looks bare, but
            you&apos;re not going to break anything by pasting a line and hitting
            Return.
          </p>
          <p>
            For each tool below, click <strong>Copy</strong>, click into your
            terminal window, and paste with{" "}
            <strong>{isPc ? "Ctrl+V (or right-click)" : "Cmd+V"}</strong>. Then
            press <strong>Return</strong>.
          </p>
          <p>
            When something is installing, you&apos;ll see lines of text scroll by
            &mdash; that&apos;s normal, it&apos;s just the computer narrating what
            it&apos;s doing. You don&apos;t need to read it. You&apos;ll know
            it&apos;s finished when the scrolling stops and you get a fresh prompt
            (a new line waiting for input) back.
          </p>
          <p>
            If a line ever looks stuck or you&apos;re not sure, that&apos;s a great
            thing to ask your assistant about later &mdash; take a screenshot and
            describe what you see.
          </p>
        </div>
      </details>

      <div className="space-y-4">
        {items.map((item) => (
          <label
            key={item.key}
            className={`flex items-start gap-4 p-4 ${optionClass(
              config.preflight[item.key],
            )}`}
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
              className="mt-1 w-5 h-5 rounded accent-brand"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-dark">{item.name}</p>
                <ExternalLink
                  href={item.link}
                  className="text-brand text-xs hover:underline"
                >
                  docs
                </ExternalLink>
              </div>
              <p className="text-ink text-sm mt-1">{item.desc}</p>
              <div className="mt-2">
                {item.copyable ? (
                  <CommandRow command={item.install} />
                ) : (
                  <p className="text-ink-soft text-xs italic">{item.install}</p>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      {!isPc && (
        <div className="mt-5 rounded-xl border border-brand-tint bg-card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-dark">
            One more thing for the helpers
          </p>
          <p className="text-sm text-ink leading-relaxed">
            A couple of behind-the-scenes tools need{" "}
            <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono">
              jq
            </code>{" "}
            (a JSON utility). Install it now so setup doesn&apos;t stall later:
          </p>
          <CommandRow command="brew install jq" />
          <p className="text-sm text-ink leading-relaxed pt-1">
            The Claude Code installer puts the{" "}
            <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono">
              claude
            </code>{" "}
            command in{" "}
            <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono">
              ~/.local/bin
            </code>
            . If your terminal says &ldquo;command not found&rdquo; after
            installing, add that folder to your PATH (your assistant will do this
            for you in the first setup session):
          </p>
          <CommandRow command={`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`} />
        </div>
      )}
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Identity                                                   */
/* ------------------------------------------------------------------ */

function IdentityStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

  return (
    <StepFrame
      current={current}
      title="Name your system"
      subtitle="This becomes your Obsidian vault directory, your project name, and the word you type to launch it. Pick something that feels right — you'll use it every day."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!config.systemName.trim() || !config.userName.trim()}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            System name
          </label>
          <input
            type="text"
            value={config.systemName}
            onChange={(e) =>
              setConfig({
                ...config,
                systemName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              })
            }
            placeholder="e.g., nexus, atlas, beacon, forge"
            className={`${inputClass} text-lg font-mono`}
          />
          {config.systemName && (
            <p className="text-ink-soft text-sm mt-2">
              Your vault will live at{" "}
              <code className="bg-paper px-1.5 py-0.5 rounded text-xs font-mono">
                ~/{config.systemName}/
              </code>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            First name
          </label>
          <input
            type="text"
            value={config.userName}
            onChange={(e) => setConfig({ ...config, userName: e.target.value })}
            placeholder="First name"
            className={inputClass}
          />
          <p className="text-ink-soft text-sm mt-2">
            Used when your system talks to you.
          </p>
        </div>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 — Google accounts                                            */
/* ------------------------------------------------------------------ */

function AccountsStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const inputClass =
    "px-4 py-3 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm";

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

  const updateAccount = (i: number, field: "email" | "label", val: string) => {
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
    <StepFrame
      current={current}
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
              className="border border-brand-tint rounded-xl p-4 space-y-3 bg-card"
            >
              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={acc.email}
                  onChange={(e) => updateAccount(i, "email", e.target.value)}
                  placeholder="you@gmail.com"
                  className={`flex-1 font-mono ${inputClass}`}
                />
                <input
                  type="text"
                  value={acc.label}
                  onChange={(e) => updateAccount(i, "label", e.target.value)}
                  placeholder="Label (e.g., Work)"
                  className={`w-40 ${inputClass}`}
                />
                {config.googleAccounts.length > 1 && (
                  <button
                    onClick={() => removeAccount(i)}
                    className="text-ink-soft hover:text-coral text-lg shrink-0"
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {[
                  { id: "personal" as const, label: "Personal Gmail" },
                  { id: "workspace" as const, label: "Company Workspace" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateAccountType(i, opt.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      acc.accountType === opt.id
                        ? "border-2 border-brand bg-brand-tint/35 text-brand"
                        : "border border-brand-tint bg-card text-ink hover:border-brand"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acc.useForEmail}
                    onChange={(e) =>
                      updateAccountUse(i, "useForEmail", e.target.checked)
                    }
                    className="w-4 h-4 rounded accent-brand"
                  />
                  Use for email
                </label>
                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acc.useForCalendar}
                    onChange={(e) =>
                      updateAccountUse(i, "useForCalendar", e.target.checked)
                    }
                    className="w-4 h-4 rounded accent-brand"
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
            className="text-brand text-sm font-medium hover:underline"
          >
            + Add another account
          </button>
          <p className="text-ink-soft text-xs">
            {emailCount} email · {calendarCount} calendar
          </p>
        </div>

        <p className="text-ink-soft text-xs leading-relaxed">
          Per-account aliases and sign-in get finished in the terminal during
          setup — this is just which accounts, and what they&apos;re for.
        </p>

        {hasWorkspace && (
          <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-5">
            <p className="font-semibold text-sm text-slate-dark mb-2">
              Heads up about company Workspace accounts
            </p>
            <p className="text-sm text-ink leading-relaxed">
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

        <div className="border-t border-brand-tint/60 pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.businessPersonalSplit}
              onChange={(e) =>
                setConfig({ ...config, businessPersonalSplit: e.target.checked })
              }
              className="mt-1 w-5 h-5 rounded accent-brand"
            />
            <div>
              <p className="font-medium text-sm text-slate-dark">
                I need to keep business and personal contexts separate
              </p>
              <p className="text-ink-soft text-sm mt-1">
                Claude Code currently uses a single config directory. We&apos;ll
                set up project-level separation so your work and personal contexts
                don&apos;t bleed into each other.
              </p>
            </div>
          </label>
        </div>

        <p className="text-ink-soft text-xs leading-relaxed">
          Under the hood, Gmail, Calendar, and Drive run through the Google
          Workspace CLI (
          <code className="bg-paper px-1 py-0.5 rounded font-mono">gws</code>),
          installed during setup. It&apos;s the primary path; the Google MCP
          connector is a fallback only for admin-locked Workspace domains.
        </p>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 7 — Task system                                                */
/* ------------------------------------------------------------------ */

function TaskSystemStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: {
    id: UserConfig["taskSystem"];
    name: string;
    desc: string;
    link?: { href: string; label: string };
    linkNote?: string;
  }[] = [
    {
      id: "todoist",
      name: "Todoist (recommended)",
      desc: "The same integration Bryan uses. Rich filter queries, priorities, labels, sections, recurring tasks, assignees — all via API. The most capable option for a system that queries your tasks programmatically.",
      link: { href: "https://todoist.com", label: "todoist.com" },
    },
    {
      id: "google-tasks",
      name: "Google Tasks",
      desc: "Works, but the API is limited — no priorities, no labels, no server-side filters, no recurring tasks via API. We'll build a CLI wrapper that compensates, but you're starting with a thinner foundation than Todoist. Choose this if staying inside Google matters more than task power.",
      linkNote: "No install needed — it comes with your Google account.",
    },
    {
      id: "other",
      name: "Something else",
      desc: "We'll note your preference and the setup skill will help you integrate it.",
    },
  ];

  return (
    <StepFrame
      current={current}
      title="Task system"
      subtitle="Your system needs a task source of truth — the place where 'what I need to do' lives. Which do you use? (Required — every option here works.)"
      onNext={onNext}
      onBack={onBack}
    >
      <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-4 mb-4">
        <p className="text-ink text-sm leading-relaxed">
          <strong className="text-slate-dark">The doctrine:</strong>{" "}your task
          manager holds dated commitments only &mdash; things you said you&apos;d
          do by a date. Everything else (the backlog) lives in your knowledge base.
          The date, not the project, is the organizing principle.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`p-4 ${optionClass(config.taskSystem === opt.id)}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="taskSystem"
                checked={config.taskSystem === opt.id}
                onChange={() => setConfig({ ...config, taskSystem: opt.id })}
                className="mt-1 w-4 h-4 accent-brand"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-slate-dark">
                    {opt.name}
                  </p>
                  {opt.link && (
                    <ExternalLink
                      href={opt.link.href}
                      className="text-brand text-xs font-medium hover:underline"
                    >
                      {opt.link.label}
                    </ExternalLink>
                  )}
                </div>
                <p className="text-ink text-sm mt-0.5 leading-relaxed">
                  {opt.desc}
                </p>
                {opt.linkNote && (
                  <p className="text-ink-soft text-xs mt-1">{opt.linkNote}</p>
                )}
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
            className="w-full px-4 py-3 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand mt-2"
          />
        )}
      </div>

      {config.taskSystem === "todoist" && (
        <div className="mt-4 rounded-xl border border-brand-tint bg-card p-4">
          <p className="text-sm font-semibold text-slate-dark mb-1">
            Do you need to pay for Todoist?
          </p>
          <p className="text-ink text-sm leading-relaxed">
            For how this system uses it &mdash; one Inbox project plus task queries
            through the API &mdash; the free tier is fine to start. Free covers up
            to 5 projects and 300 tasks per project, and API access is included on
            every plan. If you lean on lots of saved filter views (free caps at 3),
            Todoist Pro is $5/mo billed annually (about $7 month-to-month). Check{" "}
            <ExternalLink
              href="https://todoist.com/pricing"
              className="text-brand font-medium hover:underline"
            >
              todoist.com/pricing
            </ExternalLink>{" "}
            for the current numbers.
          </p>
        </div>
      )}
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 8 — Dictation                                                  */
/* ------------------------------------------------------------------ */

function DictationStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepFrame
      current={current}
      title="Dictation"
      subtitle="Optional, but the people who lean on dictation get far more out of the system than the people who type. Pick one, or skip for now."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-3">
        {DICTATION_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`p-4 ${optionClass(config.dictation.choice === opt.id)}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="dictation"
                checked={config.dictation.choice === opt.id}
                onChange={() =>
                  setConfig({ ...config, dictation: { choice: opt.id } })
                }
                className="mt-1 w-4 h-4 accent-brand"
              />
              <div>
                <ExternalLink
                  href={opt.link}
                  className="font-semibold text-sm text-slate-dark hover:text-brand"
                >
                  {opt.name}
                </ExternalLink>
                <p className="text-brand text-xs font-medium mt-0.5">
                  {opt.price}
                </p>
                <p className="text-ink text-sm mt-1 leading-relaxed">{opt.desc}</p>
              </div>
            </div>
          </label>
        ))}

        <label className={`p-4 ${optionClass(config.dictation.choice === "other")}`}>
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="dictation"
              checked={config.dictation.choice === "other"}
              onChange={() =>
                setConfig({
                  ...config,
                  dictation: { choice: "other", other: config.dictation.other },
                })
              }
              className="w-4 h-4 accent-brand"
            />
            <p className="font-semibold text-sm text-slate-dark">Something else</p>
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
              className="w-full mt-3 px-4 py-2.5 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
            />
          )}
        </label>

        <label className={`p-4 ${optionClass(config.dictation.choice === "skip")}`}>
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="dictation"
              checked={config.dictation.choice === "skip"}
              onChange={() =>
                setConfig({ ...config, dictation: { choice: "skip" } })
              }
              className="w-4 h-4 accent-brand"
            />
            <div>
              <p className="font-semibold text-sm text-slate-dark">Not now</p>
              <p className="text-ink-soft text-xs mt-0.5">
                Type for now — you can add dictation any time later.
              </p>
            </div>
          </div>
        </label>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 9 — Financial tools                                            */
/* ------------------------------------------------------------------ */

function FinancialStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const options: { id: UserConfig["financialInterest"]; name: string }[] = [
    { id: "yes", name: "Yes — I'll connect read-only financial tools during setup" },
    { id: "no", name: "No — keep money out of this system" },
    { id: "later", name: "Not sure — I'll decide during setup" },
  ];

  return (
    <StepFrame
      current={current}
      title="Financial tools"
      subtitle="Read-only, always. Nothing in this system can move or spend money."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-5 text-sm leading-relaxed text-ink">
          <p>
            I use read-only budgeting tools with zero spending capacity
            (FreshBooks for business, YNAB for personal). Whether you connect
            anything depends on your tools and your risk tolerance. The kit
            doesn&apos;t automate money &mdash; it just can see what you choose to
            show it.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`p-4 ${optionClass(config.financialInterest === opt.id)}`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="financialInterest"
                  checked={config.financialInterest === opt.id}
                  onChange={() =>
                    setConfig({ ...config, financialInterest: opt.id })
                  }
                  className="w-4 h-4 accent-brand"
                />
                <p className="font-semibold text-sm text-slate-dark">
                  {opt.name}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 10 — GitHub                                                    */
/* ------------------------------------------------------------------ */

function GitHubStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  setConfig: (c: UserConfig) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepFrame
      current={current}
      title="GitHub"
      subtitle="Effectively required — it's the backup rail for everything this kit builds."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={config.github.hasAccount && !config.github.username.trim()}
    >
      <div className="space-y-6">
        <div className="bg-slate-dark rounded-xl p-6">
          <p className="text-white/90 text-sm leading-relaxed">
            I use GitHub for two things: backing my whole system up off my
            machine every night, and hosting the web projects I build. Here&apos;s
            the thing &mdash; I don&apos;t operate git myself. My agent does.
            That&apos;s the model for every tool in this system you don&apos;t
            deeply understand: your agent is the operator, you&apos;re the
            director.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">What it gives you</p>
          {[
            "If your laptop dies, your brain survives.",
            "A time machine — every day's state of your vault is recoverable.",
            "It's how this kit and your future projects ship.",
          ].map((item, i) => (
            <div
              key={item}
              className="flex gap-3 items-start bg-brand-tint/25 rounded-xl p-3"
            >
              <p className="font-extrabold text-brand text-sm leading-none mt-0.5">
                {i + 1}
              </p>
              <p className="text-ink text-sm leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-4">
          <p className="text-ink text-sm leading-relaxed">
            <strong className="text-slate-dark">
              Non-negotiable: vault repos are PRIVATE.
            </strong>{" "}
            This is your life. The setup creates private repos by default.
          </p>
        </div>

        <div className="border-t border-brand-tint/60 pt-6 space-y-4">
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
              className="mt-1 w-5 h-5 rounded accent-brand"
            />
            <p className="font-medium text-sm text-slate-dark">
              I already have a GitHub account
            </p>
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
              className="w-full px-4 py-3 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-mono text-sm"
            />
          ) : (
            <p className="text-ink-soft text-sm leading-relaxed">
              No problem — creating a free account (github.com) is one of the first
              things setup will walk you through.
            </p>
          )}
        </div>
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 11 — Optional skills                                           */
/* ------------------------------------------------------------------ */

function SkillsStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
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
    <StepFrame
      current={current}
      title="Optional skills"
      subtitle="Core skills install automatically. These are extras — each one was built to solve a specific problem. Pick what fits your workflow."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex items-center gap-3 p-3 bg-brand-tint/20 rounded-lg flex-wrap mb-6 border border-brand-tint/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-coral" />
          <p className="text-sm text-ink">
            <span className="font-medium text-slate-dark">User-invoked</span>{" "}
            <span className="text-ink-soft">&mdash; you run it</span>
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <p className="text-sm text-ink">
            <span className="font-medium text-slate-dark">System-invoked</span>{" "}
            <span className="text-ink-soft">&mdash; fires automatically</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {OPTIONAL_SKILLS.map((skill) => (
          <label
            key={skill.id}
            className={`p-4 ${optionClass(!!config.optionalSkills[skill.id])}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!config.optionalSkills[skill.id]}
                onChange={() => toggle(skill.id)}
                className="mt-1 w-5 h-5 rounded accent-brand"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-slate-dark">
                    {skill.name}
                  </p>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                      skill.invokeType === "user"
                        ? "bg-coral/15 text-coral-deep"
                        : "bg-brand-tint/40 text-brand"
                    }`}
                  >
                    {skill.invokeType}
                  </span>
                </div>
                <p className="text-ink text-sm mt-1 leading-relaxed">
                  {skill.description}
                </p>
                {"note" in skill && skill.note && (
                  <div className="mt-2 flex items-start gap-2 bg-brand-tint/25 border border-brand-tint rounded-lg p-2.5">
                    <span className="text-brand text-sm leading-none mt-0.5">
                      ℹ
                    </span>
                    <p className="text-ink text-xs leading-relaxed">
                      {skill.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 12 — Life buckets                                              */
/* ------------------------------------------------------------------ */

function BucketsStep({
  current,
  config,
  setConfig,
  onNext,
  onBack,
}: {
  current: number;
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
    <StepFrame
      current={current}
      title="Life buckets"
      subtitle="The top-level areas of your life — pick at least two to start."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={config.buckets.length < 2}
      nextLabel={`Continue with ${config.buckets.length} bucket${
        config.buckets.length !== 1 ? "s" : ""
      }`}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-5 text-sm leading-relaxed text-ink">
          <p>
            Buckets are the top-level areas of your life &mdash; the containers
            your knowledge and your backlog live in. Your task manager only holds
            dated commitments; everything else &mdash; the someday list, the
            context, the running state of each area of your life &mdash; lives in
            your buckets.
          </p>
          <p className="mt-3">
            Projects come and go; buckets are the spine they connect back to. Each
            bucket is a folder in your vault with a living manifest note that
            accumulates everything your system learns about that part of your life.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {BUCKET_SUGGESTIONS.map((name) => {
            const selected = config.buckets.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleBucket(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  selected
                    ? "bg-brand text-white border-brand"
                    : "bg-card text-ink border-brand-tint hover:border-brand"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Add a custom bucket"
            className="flex-1 px-4 py-2.5 rounded-lg border border-brand-tint bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
          <PrimaryButton
            onClick={addCustom}
            disabled={!custom.trim()}
            className="px-4 py-2.5 text-sm"
          >
            Add
          </PrimaryButton>
        </div>

        {config.buckets.length > 0 && (
          <div>
            <p className="text-sm font-medium text-ink mb-2">Your buckets:</p>
            <div className="flex flex-wrap gap-2">
              {config.buckets.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 bg-brand-tint/40 text-brand px-3 py-1 rounded-full text-sm font-medium"
                >
                  {b}
                  <button
                    onClick={() => toggleBucket(b)}
                    className="hover:text-coral"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 13 — Review                                                    */
/* ------------------------------------------------------------------ */

function ReviewStep({
  current,
  config,
  onNext,
  onBack,
}: {
  current: number;
  config: UserConfig;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedSkills = OPTIONAL_SKILLS.filter(
    (s) => config.optionalSkills[s.id],
  );

  const rows: { label: string; value: string }[] = [
    { label: "Kit version", value: KIT_VERSION },
    { label: "Platform", value: config.platform === "pc" ? "PC (Windows)" : "Mac" },
    { label: "System name", value: config.systemName },
    { label: "First name", value: config.userName },
    { label: "Timezone", value: config.timezone },
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
          ? "Connecting read-only tools"
          : config.financialInterest === "no"
            ? "Keeping money out"
            : "Deciding during setup",
    },
    {
      label: "Optional skills",
      value:
        selectedSkills.length > 0
          ? selectedSkills.map((s) => s.name).join(", ")
          : "None selected",
    },
    { label: "Life buckets", value: config.buckets.join(", ") },
  ];

  return (
    <StepFrame
      current={current}
      title="Review your setup"
      subtitle="Here's what we'll configure. You can go back and change anything."
      onNext={onNext}
      onBack={onBack}
      nextLabel="Generate my config"
    >
      <div className="rounded-xl border border-brand-tint bg-card px-6">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 py-3 border-b border-brand-tint/50 last:border-0"
          >
            <p className="text-ink-soft text-sm font-medium w-44 shrink-0">
              {row.label}
            </p>
            <p className="text-sm text-right text-slate-dark">
              {row.value || "—"}
            </p>
          </div>
        ))}
      </div>
    </StepFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 14 — Export (completion)                                       */
/* ------------------------------------------------------------------ */

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
    <div className="flex-1 flex flex-col w-full">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <HeaderLogo />
          <p className="text-ink-soft text-sm font-medium">Complete</p>
        </div>
        <div className="h-1 w-full rounded-full bg-brand-tint/40 overflow-hidden mb-10">
          <div className="h-full rounded-full bg-coral" style={{ width: "100%" }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-dark mb-2">
          You&apos;re ready
        </h2>
        <p className="text-ink-soft text-lg leading-relaxed mb-8">
          Your config is generated. Here&apos;s what to do next.
        </p>

        <div className="space-y-6">
          <div className="bg-slate-dark rounded-xl p-6">
            <p className="text-sm font-medium text-white/60 mb-1">
              What happens next
            </p>
            <p className="text-white/80 text-sm leading-relaxed">
              You&apos;ll download your config, then hand off to Claude Code. From
              there{" "}
              <span className="text-white font-medium">
                your assistant takes over
              </span>{" "}
              &mdash; it reads your config, builds your vault, connects your tools,
              and runs your first ritual with you. The seam below is the last thing
              you do by hand.
            </p>
          </div>

          <div className="bg-slate-dark rounded-xl p-6">
            <p className="text-sm font-medium text-white/60 mb-3">
              Step 1 &mdash; Download your config
            </p>
            <button
              onClick={download}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                downloaded
                  ? "bg-white/10 text-white border border-white/20"
                  : "bg-coral text-white hover:bg-coral-deep"
              }`}
            >
              {downloaded
                ? "✓ Downloaded user-config.json"
                : "Download user-config.json"}
            </button>
            <p className="text-white/60 text-xs mt-3">
              Stamped with kit version{" "}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-white/90">
                {KIT_VERSION}
              </code>
              .
            </p>
          </div>

          <div className="bg-slate-dark rounded-xl p-6">
            <p className="text-sm font-medium text-white/60 mb-3">
              Step 2 &mdash; Clone the installer and drop your config in
            </p>
            <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed text-white/90 whitespace-pre-wrap break-all">
              <span className="text-white/50">$</span> git clone
              https://github.com/bryanstealey/personal-os-starter.git
              ~/personal-os-installer
              {"\n"}
              <span className="text-white/50">$</span> mv
              ~/Downloads/user-config.json ~/personal-os-installer/config/
            </code>
            <p className="text-white/60 text-xs mt-3">
              The installer lives in its own folder &mdash; separate from the vault
              it builds. Your vault gets created fresh at{" "}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-white/90">
                ~/{config.systemName || "your-system"}
              </code>{" "}
              during setup, with no leftover installer files inside it.
            </p>
          </div>

          <div className="bg-slate-dark rounded-xl p-6">
            <p className="text-sm font-medium text-white/60 mb-3">
              Step 3 &mdash; Start Claude Code from the installer
            </p>
            <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono text-white/90 whitespace-pre-wrap break-all">
              <span className="text-white/50">$</span> cd ~/personal-os-installer
              &amp;&amp; claude
            </code>
            <p className="text-white/60 text-xs mt-3">
              On first launch, Claude greets you by name, recaps what you&apos;ve
              configured, and continues straight into setup &mdash; installing
              skills, building your vault at{" "}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-white/90">
                ~/{config.systemName || "your-system"}
              </code>
              , connecting your tools, and creating your first project. No need to
              tell it what to do; it picks up from your config.
            </p>
          </div>

          <div className="rounded-xl border border-brand-tint bg-brand-tint/20 p-6">
            <p className="font-semibold text-sm text-slate-dark mb-2">
              This is a test build ({KIT_VERSION})
            </p>
            <p className="text-ink text-sm leading-relaxed">
              You&apos;re an early tester, so expect a rough edge or two. There
              &apos;s no auto-update yet &mdash; fixes get hand-delivered. If
              something breaks or feels off, note the kit version above and flag it;
              that tells us exactly which build you&apos;re on.
            </p>
          </div>

          <div className="rounded-xl border border-brand-tint bg-card p-6">
            <p className="font-semibold text-sm text-brand mb-2">
              A note on security
            </p>
            <p className="text-ink text-sm leading-relaxed">
              As you use Claude Code, you&apos;ll discover public skills and plugins
              you can install. Before adding any third-party skill, review its
              source code &mdash; look for unexpected network calls, file access
              patterns, or prompt injection attempts. Treat skills like npm
              packages: useful, but vet before you trust.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex items-center pt-6 mt-10 border-t border-brand-tint/60">
        <BackLink onClick={onBack} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG);

  const next = () => {
    // Stamp startedAt the first time the user advances past Welcome. The
    // installer treats a non-null startedAt as "resume," not "fresh start."
    setConfig((c) =>
      c.startedAt ? c : { ...c, startedAt: new Date().toISOString() },
    );
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => s - 1);

  return (
    <main className="flex-1 flex flex-col px-6 py-8 sm:px-8 lg:px-12 min-h-screen">
      {step === 0 && (
        <WelcomeStep config={config} setConfig={setConfig} onNext={next} />
      )}
      {step === 1 && (
        <HowItWorksStep current={1} onNext={next} onBack={back} />
      )}
      {step === 2 && (
        <PlatformStep
          current={2}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <TerminalStep
          current={3}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <InstallStep
          current={4}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <IdentityStep
          current={5}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 6 && (
        <AccountsStep
          current={6}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 7 && (
        <TaskSystemStep
          current={7}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 8 && (
        <DictationStep
          current={8}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 9 && (
        <FinancialStep
          current={9}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 10 && (
        <GitHubStep
          current={10}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 11 && (
        <SkillsStep
          current={11}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 12 && (
        <BucketsStep
          current={12}
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 13 && (
        <ReviewStep current={13} config={config} onNext={next} onBack={back} />
      )}
      {step === 14 && <ExportStep config={config} onBack={back} />}
    </main>
  );
}
