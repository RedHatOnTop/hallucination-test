# AGENTS.md

## Project Purpose

This project is an **LLM Hallucination Benchmark** — a standardized framework for intentionally provoking and quantitatively measuring coding hallucinations in large language models. It assigns LLMs the task of implementing a POSIX-compliant operating system and systematically evaluates the frequency, severity, and patterns of hallucinations produced during the process.

## Principles

- **Documents are English-first.** All documentation, specifications, code comments, and reports in this project are written in English.

## Project Structure

```
/
├── harness/              # Test harness source code and configuration
├── results/              # Test results organized by provider/model
│   ├── {provider}/
│   │   └── {model-name}/
├── .kiro/                # Kiro specs and configuration
├── AGENTS.md             # This file — project guidance for AI agents
├── README.md             # Project overview and getting started guide
└── ...                   # Other key markdown documents
```

## Key Concepts

- **Harness**: Automated test execution engine that communicates with LLM APIs, provides tools, and collects results
- **POSIX Challenge**: The benchmark task requiring OS implementation — designed to be complex enough to force confident hallucination
- **Quality Gates**: Multi-stage verification (syntax, build, boot, basic operation) using cross-compilers and QEMU
- **Hallucination Detection**: Automated classification of fabricated APIs, incorrect syscall numbers, fictitious hardware addresses, and logical contradictions
- **Sandbox**: File system isolation ensuring models cannot access files outside the project workspace
