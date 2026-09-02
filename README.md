# Heartness 👑

> **Heartness** is a hardened, multi-provider sovereign fronting and agentic cockpit built on top of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and [Cordis](https://github.com/cordiverse/cordis).

---

### 🛡️ Sovereign Guard & Extended Features
- **Context Isolator (`@deepseek-ai/dsh-sovereign-guard`):** Dynamic turn pruning and token budget bounds tailored per model (e.g. Venice <4k, Mistral <16k, Gemini 1M).
- **Tool Spill Guard:** Automatic offloading of terminal/tool outputs exceeding bounds (>100 lines / 8KB) to disk staging (`_archive/staging/spills/`) with structured head/tail previews.
- **Decision Interceptor:** Autonomous safe resolution avoiding agent stalling.
- **Roz Recycle Engine:** 48-hour auto-expiring safe file modification & recovery buffer (`_archive/staging/`).
- **Multi-Provider Topology:** Seamless routing across 9router gateways (Gemini 3.7 Flash High, Codestral, Venice Uncensored Heretic, and DeepSeek Official).
- **Visual Architecture & Canvases:** Comprehensive visual maps located in [`docs/architecture_visual.html`](docs/architecture_visual.html) and [`docs/architecture_canvas.canvas`](docs/architecture_canvas.canvas).

---

## Developer preview

Heartness is currently in _developer preview_ and is iterating rapidly.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">Heartness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
