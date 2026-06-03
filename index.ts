/**
 * Global Context Limit Extension for pi
 * 
 * Adds a `globalContextLimit` setting that overrides every model's contextWindow,
 * so all models behave as if they have the configured limit regardless of their
 * native context size. This affects compaction triggers and API requests.
 * 
 * Usage: Add `"globalContextLimit": 100000` to ~/.pi/agent/settings.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getAgentDir(): string {
  const env = process.env.PI_CODING_AGENT_DIR;
  if (env) return env;
  const os = require("node:os");
  return join(os.homedir(), ".pi", "agent");
}

function readGlobalContextLimit(): number | null {
  const agentDir = getAgentDir();
  const settingsPath = join(agentDir, "settings.json");
  
  if (!existsSync(settingsPath)) return null;
  
  try {
    const content = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    return settings.globalContextLimit ?? null;
  } catch {
    return null;
  }
}

function applyContextLimit(model: any, limit: number): boolean {
  if (!model || typeof model.contextWindow !== "number") return false;
  if (model.contextWindow <= limit) return false; // Already within limit
  
  model.contextWindow = limit;
  return true;
}

export default function (pi: ExtensionAPI) {
  let globalLimit: number | null = null;
  
  // Load limit on startup
  globalLimit = readGlobalContextLimit();
  
  if (globalLimit !== null) {
    // Apply to all models when they're registered
    // We need to intercept provider registration to cap contextWindow
    const originalRegisterProvider = pi.registerProvider.bind(pi);
    
    pi.registerProvider = function(name: string, config: any) {
      if (config?.models && Array.isArray(config.models)) {
        config.models = config.models.map((model: any) => {
          if (model.contextWindow > globalLimit!) {
            return { ...model, contextWindow: globalLimit! };
          }
          return model;
        });
      }
      return originalRegisterProvider(name, config);
    } as any;
  }
  
  // Also apply on model selection to catch any models that slip through
  pi.on("model_select", async (event, ctx) => {
    if (globalLimit === null) {
      // Re-read in case settings changed
      globalLimit = readGlobalContextLimit();
    }
    
    if (globalLimit !== null && event.model) {
      applyContextLimit(event.model, globalLimit);
    }
  });
  
  // Apply on session start
  pi.on("session_start", async (_event, ctx) => {
    globalLimit = readGlobalContextLimit();
    
    if (globalLimit !== null && ctx.model) {
      applyContextLimit(ctx.model, globalLimit);
    }
  });
  
  // Log the limit on startup
  pi.on("session_start", async (_event, ctx) => {
    if (globalLimit !== null) {
      ctx.ui.notify(`Global context limit: ${globalLimit.toLocaleString()} tokens`, "info");
    }
  });
  
  // Register /context-limit command to show/change limit
  pi.registerCommand("context-limit", {
    description: "Show or set global context limit",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        // Show current limit
        const current = readGlobalContextLimit();
        ctx.ui.notify(
          current 
            ? `Global context limit: ${current.toLocaleString()} tokens`
            : "No global context limit set",
          "info"
        );
        return;
      }
      
      const value = parseInt(args.trim(), 10);
      if (isNaN(value) || value < 1000) {
        ctx.ui.notify("Invalid limit. Must be a number >= 1000", "error");
        return;
      }
      
      // Update settings.json
      const agentDir = getAgentDir();
      const settingsPath = join(agentDir, "settings.json");
      
      let settings: any = {};
      if (existsSync(settingsPath)) {
        try {
          settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
        } catch {
          settings = {};
        }
      }
      
      settings.globalContextLimit = value;
      
      const fs = require("node:fs");
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      
      globalLimit = value;
      
      // Apply to current model
      if (ctx.model) {
        applyContextLimit(ctx.model, value);
      }
      
      ctx.ui.notify(`Global context limit set to ${value.toLocaleString()} tokens`, "info");
    },
  });
}
