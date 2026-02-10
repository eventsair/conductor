# Conductor

**Measure twice, code once.**

Conductor is a **cross-platform AI development framework** that enables **Context-Driven Development**. It turns AI coding assistants into proactive project managers that follow a strict protocol to specify, plan, and implement software features and bug fixes.

Instead of just writing code, Conductor ensures a consistent, high-quality lifecycle for every task: **Context -> Spec & Plan -> Implement**.

The philosophy behind Conductor is simple: control your code. By treating context as a managed artifact alongside your code, you transform your repository into a single source of truth that drives every agent interaction with deep, persistent project awareness.

## Supported Platforms

| Platform | Status | Command Style |
| :--- | :--- | :--- |
| **Gemini CLI** | Supported | `/conductor:setup`, `/conductor:newTrack` |
| **Claude Code** | Supported | `/conductor:setup`, `/conductor:newTrack` |
| **Augment Code** | Supported | `/conductor:setup`, `/conductor:newTrack` |
| **GitHub Copilot** | Supported | Agent Skills in `.github/skills` |

All platforms share the same core protocols and prompts — only the thin format wrapper differs. A single `build.sh` script generates platform-specific packages from canonical source files.

## Features

- **Plan before you build**: Create specs and plans that guide the agent for new and existing codebases.
- **Maintain context**: Ensure AI follows style guides, tech stack choices, and product goals.
- **Iterate safely**: Review plans before code is written, keeping you firmly in the loop.
- **Work as a team**: Set project-level context for your product, tech stack, and workflow preferences that become a shared foundation for your team.
- **Build on existing projects**: Intelligent initialization for both new (Greenfield) and existing (Brownfield) projects.
- **Smart revert**: A git-aware revert command that understands logical units of work (tracks, phases, tasks) rather than just commit hashes.
- **Platform agnostic**: One canonical set of prompts powers Gemini CLI, Claude Code, Augment Code, and GitHub Copilot.

## Installation

### Gemini CLI

```bash
gemini extensions install https://github.com/eventsair/conductor --auto-update
```

The `--auto-update` flag is optional: if specified, it will update to new versions as they are released.

### Claude Code

1. Clone and build:
   ```bash
   git clone https://github.com/eventsair/conductor.git
   cd conductor
   ./build.sh
   ```
2. Install the plugin:
   ```bash
   ./install-claude.sh
   ```
3. Restart Claude Code to load the plugin.

> **Note:** The install script registers a local marketplace and installs the plugin via `claude plugin install`. Simply copying files to `~/.claude/plugins/` is not sufficient — plugins must be registered through the marketplace system to be loaded by Claude Code.

### Augment Code

1. Build the Augment Code commands:
   ```bash
   git clone https://github.com/eventsair/conductor.git
   cd conductor
   ./build.sh
   ```
2. Copy the output into your project:
   ```bash
   cp -r dist/augment/.augment /path/to/your/project/
   cp dist/augment/CLAUDE.md /path/to/your/project/
   cp -r dist/augment/templates /path/to/your/project/.augment/
   ```

### GitHub Copilot

1. Build the Copilot Agent Skills:
   ```bash
   git clone https://github.com/eventsair/conductor.git
   cd conductor
   ./build.sh
   ```
2. Install into your project:
   ```bash
   ./install-copilot.sh /path/to/your/project
   ```
   Or manually copy the files:
   ```bash
   cp -r dist/copilot/.github /path/to/your/project/
   cp dist/copilot/COPILOT.md /path/to/your/project/
   cp -r dist/copilot/templates /path/to/your/project/
   ```
3. The skills will be automatically detected by GitHub Copilot in VS Code when you use Copilot Chat or Agent Mode.

> **Note:** GitHub Copilot Agent Skills are stored in `.github/skills` and work with GitHub Copilot in VS Code and other Agent Skills-compatible environments. Once installed, you can invoke Conductor commands naturally through Copilot Chat (e.g., "setup the conductor project" or "create a new track for user authentication").

## Usage

Conductor is designed to manage the entire lifecycle of your development tasks.

**Note on Token Consumption:** Conductor's context-driven approach involves reading and analyzing your project's context, specifications, and plans. This can lead to increased token consumption, especially in larger projects or during extensive planning and implementation phases.

### 1. Set Up the Project (Run Once)

When you run `/conductor:setup`, Conductor helps you define the core components of your project context. This context is then used for building new components or features by you or anyone on your team.

- **Product**: Define project context (e.g. users, product goals, high-level features).
- **Product guidelines**: Define standards (e.g. prose style, brand messaging, visual identity).
- **Tech stack**: Configure technical preferences (e.g. language, database, frameworks).
- **Workflow**: Set team preferences (e.g. TDD, commit strategy). Uses [workflow.md](templates/workflow.md) as a customizable template.

**Generated Artifacts:**
- `conductor/product.md`
- `conductor/product-guidelines.md`
- `conductor/tech-stack.md`
- `conductor/workflow.md`
- `conductor/code_styleguides/`
- `conductor/tracks.md`

```bash
# Gemini CLI / Claude Code / Augment Code
/conductor:setup

# GitHub Copilot (in Chat)
"Set up the conductor project"
```

### 2. Start a New Track (Feature or Bug)

When you're ready to take on a new feature or bug fix, start a new track. This initializes a **track** — a high-level unit of work. Conductor helps you generate two critical artifacts:

- **Specs**: The detailed requirements for the specific job. What are we building and why?
- **Plan**: An actionable to-do list containing phases, tasks, and sub-tasks.

**Generated Artifacts:**
- `conductor/tracks/<track_id>/spec.md`
- `conductor/tracks/<track_id>/plan.md`
- `conductor/tracks/<track_id>/metadata.json`

```bash
# Gemini CLI
/conductor:newTrack
/conductor:newTrack "Add a dark mode toggle to the settings page"

# Claude Code / Augment Code
/conductor:newTrack
/conductor:newTrack "Add a dark mode toggle to the settings page"

# GitHub Copilot (in Chat)
"Create a new track for adding a dark mode toggle to the settings page"
```

### 3. Implement the Track

Once you approve the plan, run the implement command. Your coding agent then works through the `plan.md` file, checking off tasks as it completes them.

**Updated Artifacts:**
- `conductor/tracks.md` (Status updates)
- `conductor/tracks/<track_id>/plan.md` (Status updates)
- Project context files (Synchronized on completion)

```bash
# Gemini CLI / Claude Code / Augment Code
/conductor:implement

# GitHub Copilot (in Chat)
"Implement the current track"
```

Conductor will:
1.  Select the next pending task.
2.  Follow the defined workflow (e.g., TDD: Write Test -> Fail -> Implement -> Pass).
3.  Update the status in the plan as it progresses.
4.  **Verify Progress**: Guide you through a manual verification step at the end of each phase to ensure everything works as expected.

During implementation, you can also:

- **Check status**: Get a high-level overview of your project's progress.
  ```bash
  # Gemini CLI / Claude Code / Augment Code
  /conductor:status
  
  # GitHub Copilot (in Chat)
  "Show conductor project status"
  ```
- **Revert work**: Undo a feature or a specific task if needed.
  ```bash
  # Gemini CLI / Claude Code / Augment Code
  /conductor:revert
  
  # GitHub Copilot (in Chat)
  "Revert the latest conductor changes"
  ```
- **Review work**: Review completed work against guidelines and the plan.
  ```bash
  # Gemini CLI / Claude Code / Augment Code
  /conductor:review
  
  # GitHub Copilot (in Chat)
  "Review the current track work"
  ```

## Commands Reference

| Command | Description | Artifacts |
| :--- | :--- | :--- |
| `setup` | Scaffolds the project and sets up the Conductor environment. Run this once per project. | `conductor/product.md`<br>`conductor/product-guidelines.md`<br>`conductor/tech-stack.md`<br>`conductor/workflow.md`<br>`conductor/tracks.md` |
| `newTrack` | Starts a new feature or bug track. Generates `spec.md` and `plan.md`. | `conductor/tracks/<id>/spec.md`<br>`conductor/tracks/<id>/plan.md`<br>`conductor/tracks.md` |
| `implement` | Executes the tasks defined in the current track's plan. | `conductor/tracks.md`<br>`conductor/tracks/<id>/plan.md` |
| `status` | Displays the current progress of the tracks file and active tracks. | Reads `conductor/tracks.md` |
| `revert` | Reverts a track, phase, or task by analyzing git history. | Reverts git history |
| `review` | Reviews completed work against guidelines and the plan. | Reads `plan.md`, `product-guidelines.md` |

## Project Architecture

Conductor uses a monorepo with a build step to support multiple platforms from a single canonical source:

```
conductor/
├── src/
│   ├── prompts/          # Canonical platform-agnostic prompt files
│   ├── context/          # Universal File Resolution Protocol
│   └── metadata/         # Command descriptions and platform mappings
├── templates/            # Shared workflow and code style guide templates
├── platforms/            # Platform-specific manifests
│   ├── gemini/
│   ├── claude/
│   └── augment/
├── build.sh              # Generates dist/ for all platforms
├── install-claude.sh     # Registers and installs the Claude Code plugin
├── install-copilot.sh    # Installs Copilot Agent Skills into a project
└── dist/                 # Generated platform-specific packages (gitignored)
    ├── gemini/
    ├── claude/
    ├── augment/
    └── copilot/
```

### Building from Source

```bash
./build.sh
```

This generates platform-ready packages in `dist/` by:
1. Reading canonical prompts from `src/prompts/`
2. Replacing platform-agnostic placeholders with platform-specific values
3. Wrapping content in the correct format (TOML for Gemini, SKILL.md for Claude/Copilot, .md for Augment)
4. Copying templates and manifests

## Resources

- [Gemini CLI extensions](https://geminicli.com/docs/extensions/): Documentation about using extensions in Gemini CLI
- [Claude Code plugins](https://docs.anthropic.com/en/docs/claude-code): Documentation about Claude Code
- [GitHub Copilot Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills): Documentation about using Agent Skills with GitHub Copilot
- [GitHub issues](https://github.com/eventsair/conductor/issues): Report bugs or request features

## Legal

- License: [Apache License 2.0](LICENSE)
