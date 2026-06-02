"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

interface UserConfig {
  platform: "mac" | "pc" | null;
  systemName: string;
  preflight: {
    ghostty: boolean;
    windowsTerminal: boolean;
    wsl: boolean;
    obsidian: boolean;
    claudeCode: boolean;
    zoxide: boolean;
  };
  permissionMode: "auto" | "restrictive" | "permissive";
  terminalTheme: "light" | "dark";
  googleAccounts: { email: string; label: string }[];
  businessPersonalSplit: boolean;
  taskSystem: "google-tasks" | "todoist" | "other";
  taskSystemOther?: string;
  optionalSkills: Record<string, boolean>;
  buckets: string[];
  contextSources: Record<string, boolean>;
  userName: string;
  timezone: string;
}

const DEFAULT_CONFIG: UserConfig = {
  platform: null,
  systemName: "",
  preflight: {
    ghostty: false,
    windowsTerminal: false,
    wsl: false,
    obsidian: false,
    claudeCode: false,
    zoxide: false,
  },
  permissionMode: "auto",
  terminalTheme: "light",
  googleAccounts: [{ email: "", label: "Primary" }],
  businessPersonalSplit: false,
  taskSystem: "google-tasks",
  optionalSkills: {},
  buckets: [],
  contextSources: {},
  userName: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    id: "check-anthropic",
    name: "Anthropic Update Monitor",
    description:
      "Scans Claude Code releases and Anthropic blog posts for changes that affect your setup. Bryan runs this weekly to catch new features, behavior changes, and breaking updates before they surprise him.",
    invokeType: "user" as const,
  },
  {
    id: "dev-browser",
    name: "Dev Browser",
    description:
      "Browser automation for testing web apps, taking screenshots, filling forms, and scraping data — all from Claude Code. Useful if you build or test anything that runs in a browser.",
    invokeType: "system" as const,
  },
  {
    id: "x-reader",
    name: "X/Twitter Reader",
    description:
      "Extracts full content from tweets — resolves shortened links, gets full text, engagement stats, and media. Bryan uses X as a primary information capture channel, bookmarking things throughout the day.",
    invokeType: "system" as const,
  },
  {
    id: "field-notes",
    name: "Field Notes Digest",
    description:
      "Transforms saved bookmarks into a themed visual intelligence briefing. Bryan built this to turn his X bookmarks into a weekly digest he shares with his son Julian. If you have a similar save-and-review pattern with any platform, this concept could adapt to your workflow.",
    invokeType: "user" as const,
  },
  {
    id: "claude-youtube",
    name: "YouTube Creator Toolkit",
    description:
      "Full YouTube workflow — channel audits, SEO, retention-optimized scripts, thumbnail briefs, content calendars, analytics, monetization planning. Only useful if you create YouTube content.",
    invokeType: "user" as const,
  },
  {
    id: "imessage-capture",
    name: "iMessage Self-Text Capture",
    description:
      "Monitors your iMessage for self-texts and routes them into your Obsidian vault's brain dump. Bryan texts himself ideas, tasks, and reminders throughout the day — this captures them automatically so nothing is lost. Requires macOS with iMessage.",
    invokeType: "system" as const,
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

const TOTAL_STEPS = 11;

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
          You&apos;re about to set up a personal operating system &mdash; a knowledge
          graph backed by an AI partner that understands your full life context.
          It runs on three tools:
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
          This setup will walk you through everything &mdash; from installing the
          tools to configuring your first rituals. By the end, you&apos;ll have a
          working system and the experience of using it.
        </p>
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
      name: "Auto Mode",
      recommended: true,
      desc: "Claude learns your preferences as you go. Asks the first time, remembers your answer, and stops asking for similar actions.",
      detail:
        "Most things happen smoothly. Claude only interrupts for genuinely significant operations — deleting files, pushing code, or accessing new services. This is what Bryan uses. It eliminates the fatigue of constant permission prompts while keeping you in control of what matters.",
    },
    {
      id: "restrictive",
      name: "Restrictive",
      desc: "Claude asks before almost everything. You approve each action individually.",
      detail:
        "Maximum control, but you'll see a lot of prompts — especially early on when everything is new. This can lead to approving things you don't fully understand just to keep moving. If you choose this and find it overwhelming, you can switch to Auto Mode later.",
    },
    {
      id: "permissive",
      name: "Permissive",
      desc: "Claude rarely asks. Operations happen without interruption.",
      detail:
        "Fast and frictionless, but you're trusting Claude to make good decisions about file changes, terminal commands, and tool access. Best for experienced users who understand what Claude Code does under the hood.",
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
  const terminalName = config.platform === "pc" ? "Windows Terminal" : "Ghostty";
  return (
    <StepShell
      step={2}
      title="Terminal theme"
      subtitle={`Pick a color scheme for ${terminalName}. Everything else — pane layout, status indicators — gets configured automatically during setup.`}
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
                    ? "Bryan's choice — high contrast"
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
            placeholder="e.g., nexus, atlas, cortex, forge"
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

  const macItems = [
    {
      key: "ghostty" as const,
      name: "Ghostty",
      install: "brew install --cask ghostty",
      link: "https://ghostty.org",
      desc: "A fast, modern terminal with split panes. This is where you'll interact with Claude Code across multiple projects simultaneously.",
    },
    {
      key: "obsidian" as const,
      name: "Obsidian",
      install: "brew install --cask obsidian",
      link: "https://obsidian.md",
      desc: "Your knowledge vault. Don't create a vault yet — the setup will handle that.",
    },
    {
      key: "claudeCode" as const,
      name: "Claude Code",
      install: "npm install -g @anthropic-ai/claude-code",
      link: "https://docs.anthropic.com/en/docs/claude-code",
      desc: "Your AI partner. After installing, run 'claude' once in any terminal to authenticate with your Anthropic account.",
    },
  ];

  const pcItems = [
    {
      key: "windowsTerminal" as const,
      name: "Windows Terminal",
      install: "Pre-installed on Windows 11 — open the Microsoft Store to update or to install it on Windows 10.",
      link: "https://learn.microsoft.com/en-us/windows/terminal/install",
      desc: "Your terminal. It's the modern Windows terminal with tabs and split panes — this is where you'll run Claude Code.",
    },
    {
      key: "wsl" as const,
      name: "WSL2 + Ubuntu",
      install: "wsl --install",
      link: "https://learn.microsoft.com/en-us/windows/wsl/install",
      desc: "Linux running inside Windows. Open Windows Terminal, run the command above as administrator, then restart. This keeps your system behaving like a Mac under the hood. (Your installer will help with this.)",
    },
    {
      key: "obsidian" as const,
      name: "Obsidian",
      install: "Download the Windows installer from obsidian.md",
      link: "https://obsidian.md",
      desc: "Your knowledge vault. Don't create a vault yet — the setup will handle that.",
    },
    {
      key: "claudeCode" as const,
      name: "Claude Code",
      install: "npm install -g @anthropic-ai/claude-code",
      link: "https://docs.anthropic.com/en/docs/claude-code",
      desc: "Your AI partner. Install this inside Ubuntu (WSL), then run 'claude' once to authenticate with your Anthropic account.",
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
              <code className="inline-block mt-2 bg-[#1E293B] text-[#FAFAFA] text-xs px-3 py-1.5 rounded font-mono">
                {item.install}
              </code>
            </div>
          </label>
        ))}
      </div>
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
      googleAccounts: [...config.googleAccounts, { email: "", label: "" }],
    });

  const updateAccount = (i: number, field: "email" | "label", val: string) => {
    const updated = [...config.googleAccounts];
    updated[i] = { ...updated[i], [field]: val };
    setConfig({ ...config, googleAccounts: updated });
  };

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
        <div className="space-y-3">
          {config.googleAccounts.map((acc, i) => (
            <div key={i} className="flex items-center gap-3">
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
                  className="text-[#94A3B8] hover:text-red-500 text-lg"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addAccount}
          className="text-[#16A34A] text-sm font-medium hover:underline"
        >
          + Add another account
        </button>

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
      step={5}
      title="Task system"
      subtitle="Your system needs a task source of truth — the place where 'what I need to do' lives. Which do you use?"
      onNext={onNext}
      onBack={onBack}
    >
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
      step={6}
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
                      skill.invokeType === "user"
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
      step={7}
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
      step={8}
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
      step={9}
      title="Review your setup"
      subtitle="Here's what we'll configure. You can go back and change anything."
      onNext={onNext}
      onBack={onBack}
      nextLabel="Generate my config"
    >
      <div className="space-y-4">
        {[
          { label: "Platform", value: config.platform === "pc" ? "PC (Windows)" : "Mac" },
          { label: "System name", value: config.systemName },
          { label: "Your name", value: config.userName },
          { label: "Timezone", value: config.timezone },
          {
            label: "Permissions",
            value:
              config.permissionMode === "auto"
                ? "Auto Mode (recommended)"
                : config.permissionMode === "restrictive"
                  ? "Restrictive"
                  : "Permissive",
          },
          {
            label: "Terminal theme",
            value: config.terminalTheme === "light" ? "Light" : "Dark",
          },
          {
            label: "Google accounts",
            value: config.googleAccounts
              .filter((a) => a.email)
              .map((a) => `${a.email}${a.label ? ` (${a.label})` : ""}`)
              .join(", "),
          },
          {
            label: "Biz/personal split",
            value: config.businessPersonalSplit ? "Yes" : "No",
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
            label: "Optional skills",
            value:
              selectedSkills.length > 0
                ? selectedSkills.map((s) => s.name).join(", ")
                : "None selected",
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
      step={10}
      title="You're ready"
      subtitle="Your config is generated. Here's what to do next."
      onNext={() => {}}
      onBack={onBack}
      hideNext
    >
      <div className="space-y-6">
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
        </div>

        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-3">
            Step 2 &mdash; Clone the setup repo and move your config into it
          </p>
          <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed text-[#FAFAFA]">
            <span className="text-[#94A3B8]">$</span> git clone https://github.com/bryanstealey/personal-os-starter.git ~/{config.systemName}
            <br />
            <span className="text-[#94A3B8]">$</span> mv ~/Downloads/user-config.json ~/{config.systemName}/config/
          </code>
        </div>

        <div className="bg-[#1E293B] rounded-xl p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-3">
            Step 3 &mdash; Open {config.platform === "pc" ? "Windows Terminal" : "Ghostty"} and start Claude Code
          </p>
          <code className="block bg-black/30 rounded-lg px-4 py-3 text-sm font-mono text-[#FAFAFA]">
            <span className="text-[#94A3B8]">$</span> cd ~/{config.systemName} && claude
          </code>
          <p className="text-[#94A3B8] text-xs mt-3">
            Claude will read your config and guide you through the rest &mdash;
            installing skills, creating your Obsidian vault, connecting your tools, and
            building your first project.
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
  const [step, setStep] = useState(-2);
  const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <main className="flex-1 flex flex-col px-6 py-8 sm:px-8 lg:px-12 min-h-screen">
      {step === -2 && <WelcomeStep onNext={next} />}
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
        <TaskSystemStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 6 && (
        <SkillsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 7 && (
        <BucketsStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 8 && (
        <ContextSourcesStep
          config={config}
          setConfig={setConfig}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 9 && (
        <ReviewStep config={config} onNext={next} onBack={back} />
      )}
      {step === 10 && <ExportStep config={config} onBack={back} />}
    </main>
  );
}
