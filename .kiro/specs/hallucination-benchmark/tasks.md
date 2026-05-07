# Implementation Plan: Hallucination Benchmark

## Overview

Build a CLI-based test harness in TypeScript (Node.js 20+) that orchestrates LLM API interactions to measure coding hallucinations. The harness assigns models the task of implementing a POSIX-compliant OS for i686 and evaluates quality, correctness, and originality of generated code. Implementation proceeds from foundational types and utilities through core modules, analysis pipeline, and finally CLI/publishing integration.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize project structure with package.json, tsconfig.json, and vitest.config.ts
    - Create `harness/` directory with `package.json` (commander, zod, handlebars, execa, fast-check, vitest as dependencies)
    - Create `tsconfig.json` targeting ES2022, NodeNext module resolution
    - Create `vitest.config.ts` with path aliases and test file patterns
    - _Requirements: 10.1, 11.1_

  - [x] 1.2 Define shared type definitions in `src/types/`
    - Create `src/types/index.ts` with re-exports
    - Create `src/types/session.ts` with Session, SessionConfig, WorkflowState, Checkpoint, Message, TokenUsage interfaces
    - Create `src/types/scoring.ts` with ScoreCategory, CategoryScore, ScoringResult, ScoringInput, Phase types
    - Create `src/types/hallucination.ts` with HallucinationType, HallucinationInstance, HallucinationReport interfaces
    - Define Zod schemas for runtime validation of all persisted data structures
    - _Requirements: 1.5, 4.4, 5.1, 5.6_

  - [x]* 1.3 Write unit tests for Zod schema validation
    - Test that valid objects pass schema validation
    - Test that invalid objects are rejected with descriptive errors
    - _Requirements: 1.5, 5.6_

- [x] 2. Configuration management
  - [x] 2.1 Implement config-manager in `src/core/config-manager.ts`
    - Load and parse YAML configuration files using Zod schemas
    - Support environment variable interpolation (e.g., `${ANTHROPIC_API_KEY}`)
    - Validate required fields (apiKey, apiEndpoint, provider, model) with clear error messages for missing fields
    - Serialize config back to YAML for round-trip consistency
    - Create `config.template.yaml` with documented fields
    - _Requirements: 1.5, 11.2, 11.3, 11.4, 11.5_

  - [x]* 2.2 Write property test for configuration serialization round-trip
    - **Property 3: Configuration serialization round-trip**
    - **Validates: Requirements 1.5**

  - [x]* 2.3 Write property test for API configuration validation with error reporting
    - **Property 26: API configuration validation with error reporting**
    - **Validates: Requirements 11.4, 11.5**

  - [x] 2.4 Implement path validation utility in `src/core/path-validation.ts`
    - Validate provider and model-name path components match `^[a-z0-9]+(-[a-z0-9]+)*$`
    - Construct result paths in format `results/{provider}/{model-name}`
    - _Requirements: 10.2, 10.3_

  - [x]* 2.5 Write property test for provider and model name validation
    - **Property 25: Provider and model name validation**
    - **Validates: Requirements 10.2, 10.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Sandbox implementation
  - [x] 4.1 Implement sandbox in `src/sandbox/sandbox.ts`
    - Resolve all paths relative to workspace root
    - Block path traversal attacks (`../`, absolute paths, encoded sequences, symlinks)
    - Apply restrictions uniformly across all tool types (read, write, delete, list, mkdir, exec)
    - Log violations with requested path and timestamp
    - Return access-denied errors without revealing host filesystem structure
    - Execute build commands via execa within sandbox constraints
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 9.1, 9.2, 9.3_

  - [x]* 4.2 Write property test for sandbox path containment
    - **Property 27: Sandbox path containment**
    - **Validates: Requirements 12.1, 12.2, 12.5**

  - [x]* 4.3 Write property test for sandbox violation handling
    - **Property 28: Sandbox violation handling**
    - **Validates: Requirements 12.3, 12.4**

  - [x]* 4.4 Write property test for sandbox uniform enforcement across tool types
    - **Property 29: Sandbox uniform enforcement across tool types**
    - **Validates: Requirements 12.6**

- [x] 5. Model communication adapters
  - [x] 5.1 Implement tool adapter interface and factory in `src/adapters/tool-adapter.ts`
    - Define ToolAdapter interface with sendMessage method
    - Implement adapter factory that selects tool-calling or text-marker mode based on config
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.2 Implement tool-calling adapter in `src/adapters/tool-calling-adapter.ts`
    - Send messages with tool definitions using native function calling protocol
    - Parse tool call responses into FileOperation objects
    - Handle token usage tracking
    - _Requirements: 1.2_

  - [x] 5.3 Implement text-marker adapter in `src/adapters/text-marker-adapter.ts`
    - Parse `<<<FILE: path>>>` markers from text output
    - Extract file operations (create, modify, delete) from marker blocks
    - Handle edge cases (nested markers, malformed markers)
    - _Requirements: 1.3_

  - [x]* 5.4 Write property test for text marker parsing round-trip
    - **Property 1: Text marker parsing round-trip**
    - **Validates: Requirements 1.3**

  - [x]* 5.5 Write unit tests for tool-calling adapter
    - Test parsing of various API response formats
    - Test error handling for malformed responses
    - _Requirements: 1.2_

- [x] 6. Prompt system
  - [x] 6.1 Implement reference provider in `src/prompt/reference-provider.ts`
    - Load reference documents from `references/` directory
    - Search references by query (keyword matching)
    - Filter out implementation code, providing only specs and interface definitions
    - Return relevant references for each implementation stage
    - _Requirements: 2.5, 6.1, 6.3, 9.4_

  - [x] 6.2 Implement prompt engine in `src/prompt/prompt-engine.ts`
    - Generate planning prompts with challenge context
    - Generate stage-specific implementation prompts using Handlebars templates
    - Detect incomplete code patterns (TODO, stubs, placeholders, empty bodies)
    - Generate follow-up prompts requesting rewrite when incomplete patterns detected
    - Track consecutive incomplete responses per area (3 failures → skip)
    - Apply framing strategy that prevents refusal responses
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.3 Create Handlebars prompt templates in `src/prompt/templates/`
    - Create templates for: planning, stage implementation, follow-up, verification, completion check
    - Include tone that encourages best-effort implementation
    - _Requirements: 3.1, 3.5_

  - [x]* 6.4 Write property test for incomplete code pattern detection
    - **Property 5: Incomplete code pattern detection**
    - **Validates: Requirements 3.2**

  - [x]* 6.5 Write property test for three-consecutive-failure area skip
    - **Property 6: Three-consecutive-failure area skip**
    - **Validates: Requirements 3.6**

  - [x] 6.6 Implement Challenge AGENTS.md generator in `src/prompt/agents-md-generator.ts`
    - Generate AGENTS.md with task description, phase breakdown, quality gate criteria, available tools, technical constraints, and persona assignment
    - Ensure no references to hallucination measurement or benchmarking
    - Ensure no language that would cause task refusal
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x]* 6.7 Write property test for Challenge AGENTS.md content validation
    - **Property 30: Challenge AGENTS.md content validation**
    - **Validates: Requirements 13.3, 13.8**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Session recording
  - [ ] 8.1 Implement session recorder in `src/recording/session-recorder.ts`
    - Start sessions with unique IDs and config (minus apiKey)
    - Record messages, file changes, tool calls, and gate results with timestamps
    - Record checkpoints at each state transition
    - Persist session records to JSON files in results directory
    - Finalize sessions with completion timestamp and totals
    - _Requirements: 1.4, 4.11, 9.5_

  - [ ]* 8.2 Write property test for session recording completeness and ordering
    - **Property 2: Session recording completeness and ordering**
    - **Validates: Requirements 1.4, 9.5**

- [ ] 9. State machine and orchestrator
  - [ ] 9.1 Implement state machine in `src/core/state-machine.ts`
    - Define all workflow states: Initializing, EnvironmentCheck, WorkspaceSetup, PlanningPhase, ImplementationPhase (with sub-phases), IntermediateVerification, FinalVerification, ResultCollection, Analysis, Publishing, Failed
    - Implement deterministic state transitions
    - Persist state to checkpoint file on each transition
    - Support resume from any checkpointed state
    - _Requirements: 8.1, 8.4_

  - [ ] 9.2 Implement orchestrator in `src/core/orchestrator.ts`
    - Coordinate initialization: validate environment dependencies (cross-compiler, QEMU, disk tools)
    - Set up workspace with skeleton code and Challenge AGENTS.md
    - Drive conversation loop: send prompts, receive responses, apply file operations
    - Implement retry logic with exponential backoff (up to 3 retries)
    - Detect model completion declaration and terminate session
    - Enforce tool permission (reject disallowed tools with reason)
    - Guarantee identical initial state for each model
    - Support running multiple tests for same model
    - _Requirements: 1.1, 1.6, 1.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.6_

  - [ ]* 9.3 Write property test for retry behavior correctness
    - **Property 4: Retry behavior correctness**
    - **Validates: Requirements 1.6**

  - [ ]* 9.4 Write property test for completion declaration detection
    - **Property 21: Completion declaration detection**
    - **Validates: Requirements 8.2**

  - [ ]* 9.5 Write property test for checkpoint and resume correctness
    - **Property 22: Checkpoint and resume correctness**
    - **Validates: Requirements 8.4**

  - [ ]* 9.6 Write property test for multi-run result aggregation
    - **Property 23: Multi-run result aggregation**
    - **Validates: Requirements 8.5**

  - [ ]* 9.7 Write property test for tool permission enforcement
    - **Property 24: Tool permission enforcement**
    - **Validates: Requirements 9.6**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Analysis pipeline - Quality gate
  - [ ] 11.1 Implement quality gate in `src/analysis/quality-gate.ts`
    - Run sequential verification: syntax check → build → boot → test suite
    - Syntax check: validate C/C++ source files for parse errors
    - Build check: invoke i686-elf cross-compiler, capture warnings/errors, verify binary generation
    - Boot check: launch QEMU (i386 system emulation), capture serial output, verify boot reaches serial output
    - Test suite: execute automated tests, collect pass/fail per phase
    - Record all verification logs to session recorder
    - _Requirements: 4.1, 4.2, 4.3, 4.11_

  - [ ]* 11.2 Write unit tests for quality gate pipeline
    - Test sequential execution order
    - Test that each stage produces correct GateResult structure
    - Test timeout handling for QEMU
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 12. Analysis pipeline - Scoring engine
  - [ ] 12.1 Implement scoring engine in `src/analysis/scoring-engine.ts`
    - Compute weighted final score: Build (20%) + Boot (25%) + Functionality (30%) + Consistency (15%) + Originality (10%)
    - Build score: evaluate compilation success, warning count, error count
    - Boot score: evaluate QEMU boot reaching serial output
    - Functionality score: proportional to test pass rate, scored per phase independently
    - Consistency score: inverse proportional to self-contradiction and declared-but-unimplemented ratios
    - Originality score: deductions based on plagiarism proportion
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 12.2 Write property test for weighted score computation invariant
    - **Property 7: Weighted score computation invariant**
    - **Validates: Requirements 4.4**

  - [ ]* 12.3 Write property test for build score monotonicity
    - **Property 8: Build score monotonicity**
    - **Validates: Requirements 4.5**

  - [ ]* 12.4 Write property test for functionality score proportionality
    - **Property 9: Functionality score proportionality**
    - **Validates: Requirements 4.7**

  - [ ]* 12.5 Write property test for phase scoring independence
    - **Property 10: Phase scoring independence**
    - **Validates: Requirements 4.8**

  - [ ]* 12.6 Write property test for consistency score inverse proportionality
    - **Property 11: Consistency score inverse proportionality**
    - **Validates: Requirements 4.9**

  - [ ]* 12.7 Write property test for originality score with plagiarism deductions
    - **Property 12: Originality score with plagiarism deductions**
    - **Validates: Requirements 4.10, 6.6**

- [ ] 13. Analysis pipeline - Hallucination detector
  - [ ] 13.1 Implement hallucination detector in `src/analysis/hallucination-detector.ts`
    - Detect non-existent API calls by comparing against POSIX reference documents
    - Detect incorrect syscall numbers against known POSIX values
    - Detect fictitious hardware register addresses
    - Detect logical inconsistencies in generated code
    - Detect self-contradictions across file change history
    - Detect CoT reasoning errors
    - Assign severity (critical, major, minor) to each instance
    - Output results in structured JSON format
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 13.2 Write property test for hallucination classification and severity completeness
    - **Property 13: Hallucination classification and severity completeness**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 13.3 Write property test for self-contradiction detection across file versions
    - **Property 14: Self-contradiction detection across file versions**
    - **Validates: Requirements 5.5**

  - [ ]* 13.4 Write property test for hallucination report serialization round-trip
    - **Property 15: Hallucination report serialization round-trip**
    - **Validates: Requirements 5.6**

- [ ] 14. Analysis pipeline - Plagiarism detector
  - [ ] 14.1 Implement plagiarism detector in `src/analysis/plagiarism-detector.ts`
    - Load code signature corpus from `corpus/` directory (xv6, Linux, MINIX signatures)
    - Compare model output against corpus using code similarity measurement
    - Flag blocks with ≥50 contiguous lines AND ≥70% similarity as suspected plagiarism
    - Generate plagiarism report with per-project breakdown
    - _Requirements: 6.2, 6.4, 6.5_

  - [ ]* 14.2 Write property test for code similarity measurement validity
    - **Property 16: Code similarity measurement validity**
    - **Validates: Requirements 6.4**

  - [ ]* 14.3 Write property test for plagiarism flagging threshold
    - **Property 17: Plagiarism flagging threshold**
    - **Validates: Requirements 6.5**

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Result publishing
  - [ ] 16.1 Implement result publisher in `src/publishing/result-publisher.ts`
    - Generate per-model markdown reports with summary, per-category breakdown, phase scores, hallucination highlights (top 5 by confidence)
    - Generate cross-model comparison table with all required columns
    - Update comparison table and rankings when new results are added (preserving existing entries)
    - Store results in `results/{provider}/{model-name}/` directory structure
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 10.2, 10.4_

  - [ ] 16.2 Create markdown report templates in `src/publishing/templates/`
    - Model report template with all required sections
    - Comparison table template
    - Session record browsable format template
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 16.3 Implement static site generation in `src/publishing/static-site/`
    - Configure Eleventy (11ty) for GitHub Pages-compatible output
    - Create site templates for model reports, comparison dashboard, and session browsing
    - Wire build pipeline to generate static site from results data
    - _Requirements: 7.4_

  - [ ]* 16.4 Write property test for report generation completeness
    - **Property 18: Report generation completeness**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 16.5 Write property test for incremental result update preservation
    - **Property 19: Incremental result update preservation**
    - **Validates: Requirements 7.5**

  - [ ]* 16.6 Write property test for top-5 hallucination highlight selection
    - **Property 20: Top-5 hallucination highlight selection**
    - **Validates: Requirements 7.6**

- [ ] 17. CLI interface
  - [ ] 17.1 Implement CLI entry point in `src/cli/index.ts`
    - Define commands: `run`, `resume`, `results`, `report`, `validate`
    - `run`: accept config path, provider, model, output-dir, verbose flags; validate config then start orchestrator
    - `resume`: accept session ID, resume from last checkpoint
    - `results`: query and display results in table/json/markdown format
    - `report`: generate/regenerate reports and static site
    - `validate`: validate a config file without running
    - Wire Commander.js with proper argument parsing and help text
    - _Requirements: 8.7, 11.2, 11.4_

  - [ ]* 17.2 Write unit tests for CLI argument parsing
    - Test each command with valid and invalid arguments
    - Test error messages for missing required options
    - _Requirements: 8.7_

- [ ] 18. Skeleton code and reference materials
  - [ ] 18.1 Create skeleton code in `harness/skeleton/`
    - Create `Makefile` for i686-elf cross-compilation (model is permitted to modify)
    - Create `linker.ld` with basic kernel memory layout
    - Create `boot/boot.s` with minimal Multiboot-compliant boot stub
    - _Requirements: 2.1, 2.8, 2.9, 2.11_

  - [ ] 18.2 Create reference documents in `harness/references/`
    - Create `posix-syscalls.md` with POSIX.1-2017 syscall interface specs (no implementation)
    - Create `posix-filesystem.md` with VFS and file system specs
    - Create `posix-process.md` with process management specs
    - Create `intel-i686.md` with relevant i686 architecture reference
    - Create `multiboot-spec.md` with Multiboot specification
    - _Requirements: 2.3, 2.5, 6.1, 6.3_

  - [ ] 18.3 Create plagiarism corpus stubs in `harness/corpus/`
    - Create `xv6-signatures.json` with code signature format for xv6
    - Create `linux-signatures.json` with code signature format for Linux
    - Create `minix-signatures.json` with code signature format for MINIX
    - _Requirements: 6.4_

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Integration wiring and end-to-end flow
  - [ ] 20.1 Wire orchestrator to all subsystems
    - Connect orchestrator → config-manager, state-machine, tool-adapter, prompt-engine, sandbox, quality-gate, scoring-engine, hallucination-detector, plagiarism-detector, session-recorder, result-publisher
    - Implement full workflow: environment check → workspace setup → planning → implementation stages → verification → analysis → publishing
    - Ensure no iteration limit or token budget is imposed on sessions
    - _Requirements: 1.7, 8.1, 8.2, 8.3_

  - [ ] 20.2 Implement environment dependency verification
    - Check for i686-elf cross-compiler, QEMU (i386 system emulation), disk image tools
    - Provide clear error messages with installation instructions when dependencies are missing
    - _Requirements: 8.6, 2.11_

  - [ ]* 20.3 Write integration tests for end-to-end workflow
    - Test full workflow with mocked LLM API
    - Test checkpoint save/resume across simulated process restart
    - Test environment validation with missing dependencies
    - _Requirements: 8.1, 8.4, 8.6_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate the 30 universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout — all code examples and implementations use TypeScript
- All 30 correctness properties are covered by property-based test sub-tasks using fast-check
