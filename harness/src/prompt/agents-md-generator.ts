export function generateChallengeAgentsMd(): string {
  return `# OS Implementation Project

## Overview

You are an expert operating systems developer. Your task is to implement a POSIX-compliant operating system for the i686 (x86 32-bit) architecture from scratch. This is a real development project — your implementation will be compiled with an i686-elf cross-compiler and tested in QEMU.

## Project Goals

Build a working operating system kernel that supports:
- Boot sequence and kernel initialization
- Memory management with paging
- Process scheduling and context switching
- System call interface (at least 20 basic POSIX system calls)
- Virtual File System (VFS) layer
- Basic shell

## Implementation Phases

### Phase 1: Bootloader
- Set up the boot process using GRUB Multiboot or a custom bootloader
- Initialize the GDT (Global Descriptor Table)
- Switch to 32-bit protected mode (if using custom bootloader)
- Jump to kernel entry point

### Phase 2: Memory Management
- Set up paging and page tables
- Implement physical memory allocator (bitmap or buddy system)
- Implement virtual memory management
- Handle page faults

### Phase 3: Process Scheduling
- Define process control blocks (PCBs)
- Implement context switching
- Implement a round-robin or priority scheduler
- Handle process creation (fork) and termination

### Phase 4: System Calls
- Set up interrupt descriptor table (IDT)
- Implement syscall interface (int 0x80 or sysenter/sysexit)
- Implement at least 20 basic POSIX system calls:
  read, write, open, close, fork, exec, wait, exit, getpid, getppid,
  chdir, mkdir, rmdir, pipe, dup, dup2, stat, fstat, lseek, sleep

### Phase 5: VFS Layer
- Define inode and file operations structures
- Implement a simple in-memory filesystem
- Support basic file operations: open, read, write, close, seek
- Implement directory operations
- Support device files (at minimum /dev/console)

### Phase 6: Shell
- Implement a basic command interpreter
- Support command execution with arguments
- Implement basic pipes (|) and redirections (>, <)
- Support built-in commands: cd, exit, pwd

## Available Tools

You have access to the following tools:

1. **File Operations**: Create, read, modify, and delete files
2. **Directory Listing**: List files in directories
3. **Build**: Run \`make\` to compile the project with the i686-elf cross-compiler
4. **Run in QEMU**: Execute the kernel in QEMU to test boot and functionality
5. **Reference Search**: Search provided POSIX and hardware documentation

## Technical Constraints

- **Target Architecture**: i686 (x86 32-bit)
- **Implementation Language**: C or C++ (your choice)
- **Build System**: Makefile-based (a starter Makefile is provided)
- **Cross-Compiler**: i686-elf GCC is available
- **Testing**: QEMU with i386 system emulation
- **Boot Method**: GRUB Multiboot or custom bootloader (your choice)

## Quality Criteria

Each phase should:
- Compile without errors
- Boot successfully in QEMU
- Produce serial output showing initialization progress
- Handle basic error cases

## Getting Started

Begin by examining the skeleton code provided in the workspace. The Makefile is configured for i686-elf cross-compilation. Review the reference documentation for the POSIX specification and i686 architecture details.

Take your time to implement each phase thoroughly. Good luck!
`;
}
