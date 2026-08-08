import { Injectable, LoggerService, Scope } from "@nestjs/common";
import { loggerContextStorage } from "./logger-context";

@Injectable()
export class CustomLogger implements LoggerService {
  private contextName: string = "Application";

  /**
   * Sets the context name (e.g. 'Database', 'HTTP', 'PrismaService') for logs.
   */
  setContext(context: string) {
    this.contextName = context;
  }

  log(message: any, context?: string) {
    this.writeLog("info", message, context || this.contextName);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeLog("error", message, context || this.contextName, trace);
  }

  warn(message: any, context?: string) {
    this.writeLog("warn", message, context || this.contextName);
  }

  debug(message: any, context?: string) {
    this.writeLog("debug", message, context || this.contextName);
  }

  verbose(message: any, context?: string) {
    this.writeLog("verbose", message, context || this.contextName);
  }

  private writeLog(level: string, message: any, context: string, trace?: string) {
    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId;
    const correlationId = store?.correlationId;
    const timestamp = new Date().toISOString();

    const isProduction = process.env.NODE_ENV === "production";

    // Centralized log redaction to prevent secret leakage
    const redactedMessage = redactObject(message);
    const redactedTrace = trace ? redactObject(trace) : undefined;

    // Format message string
    let logMessage = redactedMessage;
    if (typeof redactedMessage === "object" && redactedMessage !== null) {
      logMessage = redactedMessage.message || JSON.stringify(redactedMessage);
    }

    // Apply generic string-level scrubbing to messages and traces
    let logMessageStr = scrubString(typeof logMessage === "string" ? logMessage : JSON.stringify(logMessage));
    let traceStr = redactedTrace ? scrubString(typeof redactedTrace === "string" ? redactedTrace : JSON.stringify(redactedTrace)) : undefined;

    if (isProduction) {
      // Structured JSON logging for production log management systems (Splunk, ELK, etc.)
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        context,
        message: logMessageStr,
        requestId,
        correlationId,
        ...(traceStr ? { trace: traceStr } : {}),
      };
      process.stdout.write(JSON.stringify(logEntry) + "\n");
    } else {
      // Colored logging for local development
      const color = this.getColor(level);
      const reset = "\x1b[0m";
      const gray = "\x1b[90m";
      const formattedContext = context ? `[${context}]` : "";
      
      let ids = "";
      if (requestId) {
        ids = ` (Req: ${requestId.substring(0, 8)}, Corr: ${correlationId?.substring(0, 8)})`;
      }

      const output = `${gray}[${timestamp}]${reset} ${color}${level.toUpperCase().padEnd(7)}${reset} ${gray}${formattedContext}${reset} ${logMessageStr}${gray}${ids}${reset}`;

      if (level === "error") {
        process.stderr.write(output + "\n");
        if (traceStr) {
          process.stderr.write(gray + traceStr + reset + "\n");
        }
      } else {
        process.stdout.write(output + "\n");
      }
    }
  }

  private getColor(level: string): string {
    switch (level) {
      case "error":
        return "\x1b[31m"; // Red
      case "warn":
        return "\x1b[33m"; // Yellow
      case "info":
        return "\x1b[32m"; // Green
      case "debug":
        return "\x1b[35m"; // Magenta
      case "verbose":
        return "\x1b[36m"; // Cyan
      default:
        return "\x1b[37m"; // White
    }
  }
}

/**
 * Deep-redacts sensitive keys from log messages or exceptions to protect keys,
 * passwords, DEKs, KEKs, and file payloads from leakage.
 */
function redactObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Redact Bearer tokens / authorization headers if they appear as strings
    if (/bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i.test(obj)) {
      return obj.replace(/bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i, "Bearer [REDACTED]");
    }
    // Check if it looks like JSON and try to parse & redact
    const trimmed = obj.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(redactObject(parsed));
      } catch {
        // Continue as string
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  if (typeof obj === "object") {
    const redacted: any = {};
    const sensitiveKeys = new Set([
      "password", "secret", "apikey", "recoverycode", "authorization", "cookie", "dek", "kek",
      "wrappedkey", "wrapped_key", "ciphertext", "authtag", "auth_tag", "iv", "rawkey", "payload",
      "encryptedpayload", "token"
    ]);

    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z]/g, ""); // strip characters for validation matching
      let isSensitive = false;
      for (const k of sensitiveKeys) {
        if (lowerKey.includes(k)) {
          isSensitive = true;
          break;
        }
      }

      if (isSensitive) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactObject(val);
      }
    }
    return redacted;
  }

  return obj;
}

export function scrubString(str: string): string {
  if (typeof str !== "string") return str;
  let res = str;

  // Redact database credentials generically (postgresql://user:pass@host/db)
  res = res.replace(/(postgres(?:ql)?:\/\/)([^:]+):([^@\s]+)(@[^\s]+)/gi, "$1$2:[REDACTED]$4");

  // Redact Bearer / Authorization headers
  res = res.replace(/bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "Bearer [REDACTED]");

  // Redact absolute and relative physical file paths containing "storage/vault"
  res = res.replace(/[a-zA-Z]:\\[\\\w\s-._]+\\storage\\vault\\[\\\w-._]+/gi, "[FILE_PATH_REDACTED]");
  res = res.replace(/\/[\w\s-._]+\/storage\/vault\/[\w-._]+/gi, "[FILE_PATH_REDACTED]");
  res = res.replace(/storage\/vault\/[\w-._]+/gi, "[FILE_PATH_REDACTED]");
  res = res.replace(/storage\\vault\\[\w-._]+/gi, "[FILE_PATH_REDACTED]");

  // Redact canary values if they appear in strings
  res = res.replace(/VAULT_CANARY_PASSWORD_[a-zA-Z0-9]+/gi, "[REDACTED]");
  res = res.replace(/VAULT_CANARY_API_KEY_[a-zA-Z0-9]+/gi, "[REDACTED]");
  res = res.replace(/VAULT_CANARY_SECRET_[a-zA-Z0-9]+/gi, "[REDACTED]");
  res = res.replace(/VAULT_CANARY_TOKEN_[a-zA-Z0-9]+/gi, "[REDACTED]");

  return res;
}

export function scrubResponse(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return scrubString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(scrubResponse);
  }
  if (typeof obj === "object") {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = scrubResponse(v);
    }
    return res;
  }
  return obj;
}
