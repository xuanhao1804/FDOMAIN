"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";

interface ClaimBuilderProps {
  rootDomain: string;
  repository: string;
}

type HostPreset = "vercel" | "github-pages" | "netlify" | "vps";

const PRESET_DEFAULTS: Record<
  HostPreset,
  { label: string; recordType: "CNAME" | "A"; target: string }
> = {
  vercel: {
    label: "Vercel",
    recordType: "CNAME",
    target: "cname.vercel-dns.com",
  },
  "github-pages": {
    label: "GitHub Pages",
    recordType: "CNAME",
    target: "your-username.github.io",
  },
  netlify: {
    label: "Netlify",
    recordType: "CNAME",
    target: "your-site.netlify.app",
  },
  vps: {
    label: "VPS (IPv4)",
    recordType: "A",
    target: "203.0.113.10",
  },
};

export function ClaimBuilder({ rootDomain, repository }: ClaimBuilderProps) {
  const [subdomainLabel, setSubdomainLabel] = useState("my-app");
  const [githubUser, setGithubUser] = useState("");
  const [preset, setPreset] = useState<HostPreset>("vercel");
  const [target, setTarget] = useState("cname.vercel-dns.com");
  const [description, setDescription] = useState("My project deployed on Vercel");
  const [vercelVerify, setVercelVerify] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraTxt, setExtraTxt] = useState("");

  function handlePresetChange(next: HostPreset) {
    setPreset(next);
    const meta = PRESET_DEFAULTS[next];
    if (next === "github-pages" && githubUser.trim()) {
      setTarget(`${githubUser.trim().toLowerCase()}.github.io`);
    } else {
      setTarget(meta.target);
    }
    setDescription(`Project hosted on ${meta.label}`);
  }

  const cleanLabel =
    subdomainLabel.trim().toLowerCase().replace(/[^a-z0-9.-]/g, "") || "my-app";
  const cleanUser = githubUser.trim() || "your-github-username";
  const cleanTarget = target.trim() || PRESET_DEFAULTS[preset].target;
  const cleanDesc = description.trim() || `Subdomain ${cleanLabel}.${rootDomain}`;
  const isVps = preset === "vps";

  const generatedPayload: Record<string, unknown> = {
    owner: {
      github: cleanUser,
    },
    description: cleanDesc,
    records: isVps ? { A: [cleanTarget] } : { CNAME: cleanTarget },
  };

  if (vercelVerify.trim()) {
    generatedPayload.vercelVerify = [vercelVerify.trim()];
  }

  if (extraName.trim() && extraTxt.trim()) {
    const normalizedExtra = extraName.trim().startsWith("_")
      ? extraName.trim().toLowerCase()
      : `_${extraName.trim().toLowerCase()}`;
    generatedPayload.extra = {
      [normalizedExtra]: { TXT: [extraTxt.trim()] },
    };
  }

  const jsonOutput = `${JSON.stringify(generatedPayload, null, 2)}\n`;
  const githubCreateUrl = `https://github.com/${repository}/new/main/domains?filename=${encodeURIComponent(`${cleanLabel}.json`)}&value=${encodeURIComponent(jsonOutput)}`;

  return (
    <div className="reveal-block space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Claim a Subdomain
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Configure your DNS target below, then open a pre-filled Pull Request on GitHub.
          Trusted friends auto-merge in ~1 minute.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Form Card */}
        <form
          onSubmit={(e) => e.preventDefault()}
          aria-labelledby="builder-form-title"
          className="chibi-panel min-w-0 space-y-5 p-5 sm:p-6"
        >
          <h2 id="builder-form-title" className="font-display text-lg font-extrabold">
            1. Subdomain Details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-label" className="text-xs font-bold uppercase tracking-wide">
                Subdomain name
              </label>
              <div
                className="flex min-w-0 items-center overflow-hidden rounded-xl border-2"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              >
                <input
                  id="claim-label"
                  name="subdomainLabel"
                  type="text"
                  value={subdomainLabel}
                  onChange={(e) => setSubdomainLabel(e.target.value)}
                  placeholder="portfolio"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono-code min-h-11 min-w-0 w-full flex-1 bg-transparent px-3 text-base sm:text-sm"
                />
                <span
                  className="font-mono-code shrink-0 border-l-2 px-2.5 py-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--bg-subtle)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-muted)",
                  }}
                >
                  .{rootDomain}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-github" className="text-xs font-bold uppercase tracking-wide">
                GitHub username
              </label>
              <input
                id="claim-github"
                name="githubUser"
                type="text"
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                placeholder="alice-gh"
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              />
            </div>
          </div>

          <fieldset className="min-w-0 space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wide">
              Hosting provider preset
            </legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESET_DEFAULTS) as HostPreset[]).map((key) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handlePresetChange(key)}
                    className="min-h-10 cursor-pointer rounded-full border-2 px-4 text-xs font-bold transition-transform active:scale-95"
                    style={{
                      backgroundColor: active ? "var(--sky)" : "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                      color: active ? "#24324a" : "var(--text-primary)",
                      boxShadow: active ? "0 2px 0 var(--border-color)" : "none",
                    }}
                  >
                    {PRESET_DEFAULTS[key].label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-target" className="text-xs font-bold uppercase tracking-wide">
                {isVps ? "Target IPv4 (A record)" : "Target Hostname (CNAME)"}
              </label>
              <input
                id="claim-target"
                name="target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-desc" className="text-xs font-bold uppercase tracking-wide">
                Short description
              </label>
              <input
                id="claim-desc"
                name="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              />
            </div>
          </div>

          {preset === "vercel" ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-vercel-txt" className="text-xs font-bold uppercase tracking-wide">
                Vercel verification TXT (if prompted)
              </label>
              <input
                id="claim-vercel-txt"
                name="vercelVerify"
                type="text"
                value={vercelVerify}
                onChange={(e) => setVercelVerify(e.target.value)}
                placeholder={`vc-domain-verify=${cleanLabel}.${rootDomain},...`}
                aria-describedby="vercel-verify-hint"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              />
              <p id="vercel-verify-hint" className="text-xs" style={{ color: "var(--text-muted)" }}>
                Required only if Vercel says the domain is linked to another account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="claim-extra-name" className="text-xs font-bold uppercase tracking-wide">
                  Optional _challenge prefix
                </label>
                <input
                  id="claim-extra-name"
                  name="extraName"
                  type="text"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="_github-pages-challenge-user"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="claim-extra-txt" className="text-xs font-bold uppercase tracking-wide">
                  Challenge TXT value
                </label>
                <input
                  id="claim-extra-txt"
                  name="extraTxt"
                  type="text"
                  value={extraTxt}
                  onChange={(e) => setExtraTxt(e.target.value)}
                  placeholder="challenge-token"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>
            </div>
          )}
        </form>

        {/* Live Output & Submit Card */}
        <div className="min-w-0 space-y-4">
          <div className="chibi-row-card min-w-0 space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-extrabold">2. Generated File</h2>
                <span className="font-mono-code text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  domains/{cleanLabel}.json
                </span>
              </div>
              <CopyButton value={jsonOutput} label="Copy generated subdomain JSON" showText />
            </div>

            <pre
              className="font-mono-code overflow-x-auto rounded-xl border p-4 text-xs leading-relaxed"
              style={{
                backgroundColor: "var(--bg-subtle)",
                borderColor: "var(--border-color)",
              }}
            >
              <code>{jsonOutput}</code>
            </pre>

            <a
              href={githubCreateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chibi-cta w-full"
            >
              Open GitHub &amp; Create PR →
            </a>
          </div>

          <div
            className="rounded-2xl border-2 p-4 text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--bg-cream)",
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            <p className="font-bold" style={{ color: "var(--text-primary)" }}>
              Rules summary
            </p>
            <ul role="list" className="mt-1.5 list-disc space-y-1 pl-4">
              <li>All records are DNS-only (no Cloudflare orange proxy).</li>
              <li>Nested subdomains (e.g. <code>api.blog</code>) require owning the parent file.</li>
              <li>
                Need details? Read{" "}
                <a
                  href={`https://github.com/${repository}/blob/main/docs/contributing.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  docs/contributing.md
                </a>
                .
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
