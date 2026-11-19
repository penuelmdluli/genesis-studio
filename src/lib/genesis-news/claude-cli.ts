// ============================================
// The local Claude Code CLI as a function call
// ============================================
// Genesis News runs on the owner's PC, which has `claude` signed in to their
// subscription — so research (web search), looking at footage (frame sheets)
// and writing copy cost no API key. The prompt goes in on stdin so Windows
// never re-quotes it. Anywhere the CLI does not exist this throws.

export interface ClaudeOpts {
  /** Tools the run may use without asking, e.g. ["Read"], ["WebSearch", "WebFetch"]. */
  tools?: string[];
  /** Working directory. Files Claude must Read should live under it. */
  cwd?: string;
  model?: string;
  timeoutMs?: number;
}

export async function runClaude(prompt: string, opts: ClaudeOpts = {}): Promise<string> {
  const { spawn } = await import("node:child_process");
  const args = ["-p", "--output-format", "json", "--model", opts.model || process.env.GENESIS_NEWS_CLAUDE_MODEL || "sonnet"];
  if (opts.tools?.length) args.push("--allowedTools", opts.tools.join(","));
  const timeoutMs = opts.timeoutMs ?? 120_000;
  return new Promise((resolve, reject) => {
    // .env.local carries ANTHROPIC_API_KEY for the web app; the CLI would
    // pick it up over the subscription login (and fail when that key is out
    // of credit). The CLI always runs on the owner's login.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn("claude", args, {
      cwd: opts.cwd,
      env,
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exit ${code}: ${(err || out).trim().slice(0, 300)}`));
      try {
        const envelope = JSON.parse(out) as { result?: string; is_error?: boolean };
        if (envelope.is_error || !envelope.result) {
          return reject(new Error(`claude CLI error: ${String(envelope.result).slice(0, 300)}`));
        }
        resolve(envelope.result);
      } catch (e) {
        reject(e as Error);
      }
    });
    child.stdin.end(prompt);
  });
}

/** The last {...} object in a reply — models sometimes wrap JSON in prose or a fence. */
export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = fenced.exec(text))) last = m[1];
  const body = last ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(body) as T;
}

export async function claudeJson<T>(prompt: string, opts: ClaudeOpts = {}): Promise<T> {
  return extractJson<T>(await runClaude(prompt, opts));
}
