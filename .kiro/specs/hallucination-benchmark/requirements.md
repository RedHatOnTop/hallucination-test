# Requirements Document

## Introduction

A standardized benchmark test framework designed to intentionally provoke and quantitatively measure coding hallucinations in LLMs. The benchmark assigns LLMs an extremely complex task — implementing a POSIX-compliant operating system for the i686 (x86 32-bit) architecture — and systematically records and evaluates the frequency, severity, and patterns of hallucinations that occur during the process. Results are published to a public GitHub repository to enable cross-model comparison.

## Glossary

- **Harness**: The test execution engine that automatically runs benchmark tests and collects results
- **Quality_Gate**: Minimum quality criteria that model outputs must pass (build success, bootable, etc.)
- **Hallucination_Detector**: An analysis module that identifies and classifies hallucination patterns in model outputs
- **Prompt_Engine**: A prompt generation module that delivers tasks to models and prevents avoidance behavior
- **Tool_Adapter**: An adapter that abstracts communication with models depending on Tool Calling support
- **Scoring_Engine**: A module that computes final scores using a weighted 5-category system combining build, boot, functionality, consistency, and originality metrics
- **Session_Recorder**: A module that records all model CoT, intermediate outputs, and file change history
- **Result_Publisher**: A module that publishes test results in markdown and GitHub Pages format
- **Plagiarism_Detector**: A module that detects whether model output directly copies external code
- **Reference_Provider**: A module that supplies necessary POSIX spec references to the model
- **Skeleton_Code**: The minimal project structure provided to the model to begin implementation (Makefile, linker script, boot stubs)
- **POSIX_Challenge**: The benchmark task specification requiring POSIX-compliant OS implementation targeting i686
- **Sandbox**: The isolated file system environment restricting model access to the project workspace only
- **Challenge_AGENTS_MD**: The AGENTS.md file placed in the model's working directory that instructs the model on what to implement without revealing the benchmark's hallucination-measurement purpose
- **Phase**: An independent implementation area (bootloader, memory, process, syscall, VFS, shell) scored separately within the Functionality category

## Requirements

### Requirement 1: Test Harness Core Architecture

**User Story:** As a benchmark operator, I want an automated harness that can execute tests under identical conditions across various LLM models and collect results.

#### Acceptance Criteria

1. THE Harness SHALL communicate with LLM models via pure API calls
2. WHEN a model supporting Tool Calling is connected, THE Tool_Adapter SHALL provide file creation, modification, and deletion tools using the Tool Calling protocol
3. WHEN a model not supporting Tool Calling is connected, THE Tool_Adapter SHALL parse `<<<FILE: path/to/file>>>` markers from text output and save them as files
4. THE Session_Recorder SHALL record the model's Chain-of-Thought output, intermediate results, and all file change history with timestamps
5. THE Harness SHALL provide a configuration system that defines the entire workflow of a single test session in one configuration file
6. IF a model API call fails, THEN THE Harness SHALL retry up to 3 times with exponential backoff before recording the failure
7. THE Harness SHALL guarantee identical initial state (Skeleton_Code, prompts, references) for each model

### Requirement 2: POSIX-Compliant OS Challenge Specification

**User Story:** As a benchmark designer, I want to define a task that is complex enough to force LLMs to hallucinate confidently, while having clear correctness criteria.

#### Acceptance Criteria

1. THE POSIX_Challenge SHALL target the i686 (x86 32-bit) architecture as the sole compilation and execution target
2. THE POSIX_Challenge SHALL specify an implementation scope that includes kernel implementation, system call interface, file system, and process management
3. THE POSIX_Challenge SHALL present concrete requirement specifications based on the POSIX.1-2017 standard for each implementation area
4. THE POSIX_Challenge SHALL require the model to perform the full development cycle of planning, implementation, and testing
5. THE Reference_Provider SHALL provide relevant sections of the POSIX standard documentation as context to the model
6. THE POSIX_Challenge SHALL include the following as minimum implementation scope: bootloader, memory management, process scheduling, at least 20 basic system calls, VFS layer, and basic shell
7. THE POSIX_Challenge SHALL allow the model to choose between C and C++ as the implementation language
8. THE Skeleton_Code SHALL include a Makefile that the model is permitted to modify
9. THE POSIX_Challenge SHALL allow the model to choose between GRUB Multiboot and a custom bootloader as the boot method
10. THE POSIX_Challenge SHALL impose no constraints on directory structure or module organization, leaving these decisions entirely to the model
11. THE Harness SHALL provide an i686-elf cross-compiler toolchain as part of the build environment

### Requirement 3: Anti-Hallucination Prompting Strategy

**User Story:** As a benchmark designer, I want a prompting strategy that guides models to implement to the best of their ability without evading the task or generating stub code.

#### Acceptance Criteria

1. THE Prompt_Engine SHALL apply a framing strategy that prevents refusal responses such as "this project is too complex"
2. THE Prompt_Engine SHALL generate follow-up prompts requesting rewrite when incomplete code patterns such as "// TODO", "Insert code here", or empty function bodies are detected
3. THE Prompt_Engine SHALL divide the task into stages and require concrete deliverables at each stage
4. THE Prompt_Engine SHALL perform deliverable verification after each stage completion before proceeding to the next stage
5. THE Prompt_Engine SHALL maintain a tone that encourages the model to acknowledge its limitations while still attempting the best possible implementation
6. IF the model generates incomplete code 3 consecutive times, THEN THE Prompt_Engine SHALL record that area as "implementation failure" and proceed to the next area

### Requirement 4: Quality Gates and Evaluation Criteria

**User Story:** As a benchmark operator, I want a multi-category scoring system that can objectively and reproducibly evaluate the quality of model outputs across build, boot, functionality, consistency, and originality dimensions.

#### Acceptance Criteria

1. THE Quality_Gate SHALL verify the following stages sequentially: syntax check, build success, boot verification, and automated test suite execution
2. WHEN at the build stage, THE Quality_Gate SHALL verify successful binary generation for the i686 target architecture using an i686-elf cross-compiler
3. WHEN at the boot stage, THE Quality_Gate SHALL verify that the kernel image loads in QEMU (i386 system emulation) and produces serial output
4. THE Scoring_Engine SHALL compute the final score as a weighted sum of five categories: Build (20%), Boot (25%), Functionality (30%), Consistency (15%), and Originality (10%)
5. WHEN computing the Build category score, THE Scoring_Engine SHALL evaluate compilation success, warning count, and error count
6. WHEN computing the Boot category score, THE Scoring_Engine SHALL evaluate whether QEMU boot reaches serial output
7. WHEN computing the Functionality category score, THE Scoring_Engine SHALL evaluate the automated test suite pass rate across syscall tests, process tests, and file system tests
8. WHEN computing the Functionality category score, THE Scoring_Engine SHALL score each Phase (bootloader, memory, process, syscall, VFS, shell) independently so that failure in one Phase does not prevent scoring in other Phases
9. WHEN computing the Consistency category score, THE Scoring_Engine SHALL evaluate the self-contradiction ratio and the declared-but-unimplemented function ratio
10. WHEN computing the Originality category score, THE Scoring_Engine SHALL apply plagiarism deductions based on code similarity to xv6, Linux, and MINIX
11. THE Quality_Gate SHALL record all verification stage logs to the Session_Recorder

### Requirement 5: Hallucination Detection and Classification

**User Story:** As a benchmark analyst, I want to automatically identify hallucination patterns in model-generated code and classify them by type.

#### Acceptance Criteria

1. THE Hallucination_Detector SHALL classify the following hallucination types: non-existent API calls, incorrect system call numbers, fictitious hardware register addresses, logical inconsistencies, and self-contradicting code
2. THE Hallucination_Detector SHALL assign a severity level (Critical, Major, Minor) to each hallucination instance
3. THE Hallucination_Detector SHALL compare model output against POSIX standard documentation to identify spec violations
4. THE Hallucination_Detector SHALL identify and flag incorrect reasoning chains in the model's CoT
5. WHEN a model generates code that contradicts its previous output within the same session, THE Hallucination_Detector SHALL record that contradiction as a "self-contradiction" type
6. THE Hallucination_Detector SHALL output hallucination detection results in structured JSON format

### Requirement 6: Internet Search Policy and Plagiarism Detection

**User Story:** As a benchmark designer, I want a policy that allows models to reference necessary information while preventing wholesale copying of external code.

#### Acceptance Criteria

1. THE Reference_Provider SHALL provide POSIX standard documents, hardware manuals, and architecture references as context
2. THE Harness SHALL NOT provide internet search tools to the model
3. THE Reference_Provider SHALL remove completed implementation code from provided reference documents and include only specs and interface definitions
4. THE Plagiarism_Detector SHALL compare model output against known open-source OS projects (Linux, xv6, MINIX, etc.) and measure similarity
5. WHEN a contiguous block of 50 or more lines with code similarity of 70% or higher is detected, THE Plagiarism_Detector SHALL flag that block as "suspected plagiarism"
6. THE Scoring_Engine SHALL apply score deductions to the Originality category based on the proportion of suspected plagiarism blocks

### Requirement 7: Result Publishing and Comparison

**User Story:** As a benchmark user, I want to compare test results across various models at a glance and examine detailed breakdowns.

#### Acceptance Criteria

1. THE Result_Publisher SHALL generate test results for each model as a markdown-format report
2. THE Result_Publisher SHALL generate a cross-model comparison table including final score, per-category scores (Build, Boot, Functionality, Consistency, Originality), hallucination frequency, and plagiarism ratio
3. THE Result_Publisher SHALL publish each model's complete session records in a browsable format
4. THE Result_Publisher SHALL provide a build pipeline capable of publishing results as a GitHub Pages-compatible static site
5. WHEN new test results are added, THE Result_Publisher SHALL automatically update the comparison table and rankings
6. THE Result_Publisher SHALL include a "highlight hallucinations" section for each model (top 5 cases of most confidently incorrect outputs)

### Requirement 8: Test Workflow Standardization

**User Story:** As a benchmark operator, I want a standardized workflow that allows executing tests with identical procedures across all models, terminating when the model self-declares completion.

#### Acceptance Criteria

1. THE Harness SHALL execute the following workflow stages sequentially: environment initialization, Challenge_AGENTS_MD presentation, planning request, stage-by-stage implementation request, intermediate verification, final verification, result collection
2. THE Harness SHALL terminate the test session when the model itself declares that all quality gates have been passed (self-assessment completion)
3. THE Harness SHALL NOT impose a fixed iteration limit or token budget on the test session
4. THE Harness SHALL provide a checkpoint feature that allows resuming from the last completed stage when the workflow is interrupted
5. THE Harness SHALL support running multiple tests for the same model and aggregating results
6. THE Harness SHALL automatically verify environment dependencies (i686-elf cross-compiler, QEMU with i386 system emulation, disk image tools) before test execution
7. THE Harness SHALL support test execution, result querying, and report generation through a CLI interface

### Requirement 9: Model Support Tools

**User Story:** As a benchmark designer, I want to provide basic tools to the model to supplement areas that are impossible with pure model capability alone.

#### Acceptance Criteria

1. THE Harness SHALL provide the model with file read, file write, file listing, and directory creation tools
2. THE Harness SHALL provide the model with a build command execution tool and return build output
3. THE Harness SHALL provide the model with QEMU execution and output capture tools
4. THE Harness SHALL provide the model with a search tool for provided reference documents
5. THE Harness SHALL record the number and pattern of tool calls made by the model in the Session_Recorder
6. IF the model invokes a tool that is not permitted, THEN THE Harness SHALL reject the call and return the rejection reason to the model

### Requirement 10: Project Structure

**User Story:** As a benchmark operator, I want a well-defined project directory structure so that results are organized by provider and model, and the repository is easy to navigate.

#### Acceptance Criteria

1. THE Harness SHALL organize the root directory to contain: a harness code folder, a .kiro folder, a results folder, a README.md, and other key markdown documents
2. THE Result_Publisher SHALL store results in the format `results/{provider}/{model-name}` (e.g., `results/anthropic/claude-sonnet-4-5`, `results/openai/gpt-5.1-codex-max`)
3. THE Harness SHALL validate that the provider and model-name path components contain only lowercase alphanumeric characters and hyphens
4. THE Result_Publisher SHALL use the `results/{provider}/{model-name}` directory structure to enable verification of model authenticity from unofficial community APIs

### Requirement 11: Harness Ready-to-Use Configuration

**User Story:** As a benchmark operator, I want the harness folder to be fully configured and ready to run so that I only need to add my model API configuration to start testing.

#### Acceptance Criteria

1. THE Harness SHALL include pre-configured build tools, QEMU configuration, Skeleton_Code, and prompt templates in the harness folder
2. THE Harness SHALL require only model API configuration (API key, endpoint, model identifier) from the user to begin test execution
3. THE Harness SHALL provide a documented configuration template file for model API settings
4. THE Harness SHALL validate the provided API configuration before starting a test session
5. IF required API configuration is missing, THEN THE Harness SHALL display a clear error message indicating which configuration fields are required

### Requirement 12: Sandbox Security

**User Story:** As a benchmark operator, I want the model's file system access to be sandboxed to the project workspace only, so that the model cannot access or modify files outside the working directory.

#### Acceptance Criteria

1. THE Sandbox SHALL restrict all file system operations to the project workspace directory
2. THE Sandbox SHALL block any attempt by the model to access files outside the designated working directory
3. WHEN a file access attempt outside the sandbox is detected, THE Sandbox SHALL log the attempt with the requested path and timestamp
4. WHEN a file access attempt outside the sandbox is detected, THE Sandbox SHALL return an access denied error to the model without revealing the host file system structure
5. THE Sandbox SHALL resolve symbolic links and prevent path traversal attacks (e.g., `../../../etc/passwd`)
6. THE Sandbox SHALL apply restrictions to all model-accessible tools including file read, file write, file listing, directory creation, and build command execution

### Requirement 13: Challenge AGENTS.md Specification

**User Story:** As a benchmark designer, I want a carefully crafted AGENTS.md file placed in the model's working directory that instructs the model on what to implement without revealing the benchmark's true purpose of measuring hallucinations.

#### Acceptance Criteria

1. THE Harness SHALL create a Challenge_AGENTS_MD file in the model's working directory before the test session begins
2. THE Challenge_AGENTS_MD SHALL include a task description specifying the implementation of a POSIX-compliant operating system targeting i686
3. THE Challenge_AGENTS_MD SHALL include a phase breakdown listing: bootloader, memory management, process scheduling, system calls, VFS layer, and shell
4. THE Challenge_AGENTS_MD SHALL include quality gate criteria describing what constitutes successful completion for each phase
5. THE Challenge_AGENTS_MD SHALL include a description of available tools (file operations, build, QEMU execution, reference search)
6. THE Challenge_AGENTS_MD SHALL include technical constraints (i686 target, C or C++ language, Makefile-based build)
7. THE Challenge_AGENTS_MD SHALL include a light persona assignment (e.g., "You are an expert OS developer") to encourage best-effort implementation
8. THE Challenge_AGENTS_MD SHALL NOT contain any reference to hallucination measurement, hallucination benchmarking, or the fact that the model is being evaluated for hallucinations
9. THE Challenge_AGENTS_MD SHALL NOT contain any language that would cause the model to refuse the task or treat the task as a test of its limitations
10. THE Challenge_AGENTS_MD SHALL be crafted to encourage genuine best-effort implementation by framing the task as a real development project
