import { render } from "ink";
import { ErrorBoundary } from "./components/ErrorBoundary";
import RoutersList from "./components/RoutersList";
import {
  beginExclusiveInput,
  endExclusiveInput,
  enterExternal,
  exitExternal,
  mutableStdin,
  mutableStdout,
} from "./ink-control";
import { setupGlobalErrorHandlers } from "./services/error-handler";
import { initializeLogger, log } from "./services/logger";

function setupAlternateScreen() {
  if (typeof process === "undefined") return;
  const out = process.stdout as any;
  const isTTY = !!out && typeof out.isTTY === "boolean" ? out.isTTY : false;
  if (!isTTY) return;

  let cleaned = false;
  const enable = () => {
    try {
      out.write("\u001B[?1049h");
    } catch {}
  };
  const disable = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      out.write("\u001B[?1049l");
    } catch {}
  };

  enable();

  process.on("exit", disable);
  // Don't handle SIGINT here - let the App component handle it for proper cleanup
  process.on("SIGTERM", () => {
    disable();
    process.exit(143);
  });
  process.on("SIGHUP", () => {
    disable();
    process.exit(129);
  });
  process.on("uncaughtException", (err) => {
    disable();
    console.error(err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    disable();
    console.error(reason);
    process.exit(1);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let apiUrl: string | undefined;
  const ignorePatterns: string[] = [];
  let insecure = false;
  const basicAuth = process.env.TRAEFIKTOP_BASIC_AUTH;

  const pushIgnore = (val?: string) => {
    if (!val) return;
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        ignorePatterns.push(s);
      });
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      console.log(
        "Usage: traefiktop --host <url> [--ignore <pat>[,<pat>...]] [--ignore <pat>]... [--insecure]",
      );
      console.log(
        "  --host     REQUIRED. Traefik API base URL (e.g. https://traefik.local)",
      );
      console.log(
        "  --ignore   Hide routers by name (case-insensitive). Supports '*prefix', 'suffix*', and '*contains*'.",
      );
      console.log(
        "  --insecure Disable TLS certificate verification (development only)",
      );
      process.exit(0);
    }
    if (a === "--host" || a === "--api-url") {
      apiUrl = args[i + 1] || apiUrl;
      i += 1;
      continue;
    }
    if (a.startsWith("--host=")) {
      apiUrl = a.split("=")[1] || apiUrl;
      continue;
    }
    if (a === "--ignore") {
      pushIgnore(args[i + 1]);
      i += 1;
      continue;
    }
    if (a.startsWith("--ignore=")) {
      pushIgnore(a.split("=")[1]);
    }
    if (a === "--insecure") {
      insecure = true;
    }
    // no-op
  }

  // tail-logs command removed (handled by dev tool only)

  if (!apiUrl) {
    console.error("Error: --host <url> is required. See --help for usage.");
    process.exit(1);
  }
  if (insecure) {
    process.env.TRAEFIKTOP_INSECURE = "1";
    console.warn(
      "⚠️  Insecure TLS enabled: certificate verification is disabled",
    );
  }
  // Initialize logger for normal app mode
  const loggerResult = await initializeLogger();
  if (loggerResult.isErr()) {
    console.error(
      `❌ Failed to initialize logger: ${loggerResult.error.message}`,
    );
    process.exit(1);
  }

  const logger = loggerResult.value;

  // Setup global error handlers (after logger is initialized)
  setupGlobalErrorHandlers();

  log.info("traefiktop session started", "main", {
    sessionId: logger.getSessionId(),
    logFile: logger.getLogFilePath(),
  });

  setupAlternateScreen();

  process.on("external-enter", () => {
    beginExclusiveInput();
    enterExternal();
  });

  process.on("external-exit", async () => {
    endExclusiveInput();
    exitExternal();

    const oldCols = process.stdout.columns;
    process.stdout.columns = oldCols - 1;
    process.stdout.emit("resize");

    await new Promise((resolve) => setTimeout(resolve, 0));

    process.stdout.columns = oldCols;
    process.stdout.emit("resize");
  });

  try {
    render(
      <ErrorBoundary>
        <RoutersList
          apiUrl={apiUrl}
          basicAuth={basicAuth}
          ignorePatterns={ignorePatterns}
        />
      </ErrorBoundary>,
      {
        stdout: mutableStdout as any,
        stderr: process.stderr,
        stdin: mutableStdin as any,
        patchConsole: false,
        exitOnCtrlC: false,
      },
    );
    try {
      // Alternate screen is already enabled earlier; only attach stdin here
      mutableStdin.attach(process.stdin as any);
    } catch {}
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error("Failed to render React application", "main", {
      message: err.message,
      stack: err.stack,
    });
    console.error("❌ Failed to render application:", err.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Failed to start application:", error);
  process.exit(1);
});
