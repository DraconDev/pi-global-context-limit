# Global Context Limit Extension for pi

Adds a `globalContextLimit` setting that overrides every model's `contextWindow`, so all models behave as if they have the configured limit regardless of their native context size.

## Why Use This?

Different models have different context windows (Claude: 200K, GPT-4o: 128K, MiniMax M3: 1M). If you want consistent behavior across all models, or want to limit token usage, this extension caps all models to a single limit.

## Setup

Add to `~/.pi/agent/settings.json`:

```json
{
  "globalContextLimit": 200000
}
```

## How It Works

1. On model selection, the extension caps `model.contextWindow` to the configured limit
2. On session start, the current model is capped
3. The `/context-limit` command lets you view or change the limit at runtime

## Commands

| Command | Description |
|---------|-------------|
| `/context-limit` | Show current limit |
| `/context-limit 100000` | Set limit to 100K tokens |

## Effect on Compaction

Compaction triggers when `contextTokens > contextWindow - reserveTokens`. With a global limit:

- 200K model capped to 200K → compaction at ~168K tokens (no change)
- 1M model capped to 200K → compaction at ~168K tokens (instead of ~984K)
- 128K model capped to 200K → compaction at ~112K tokens (no change, already under limit)

## Files

- `index.ts` - Extension source
- `README.md` - This file
- `LICENSE` - MIT license

## Install

```bash
pi install git:github.com/DraconDev/pi-global-context-limit
```
