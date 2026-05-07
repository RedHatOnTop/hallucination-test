# POSIX Process Management Specification (POSIX.1-2017)

## Process Concepts

### Process Control Block (PCB)
- Process ID (PID)
- Parent PID (PPID)
- Process state (running, ready, blocked, zombie)
- Register context (saved registers for context switch)
- Stack pointer
- Program counter
- Open file descriptors table
- Working directory
- Scheduling priority

### Process States
1. **Created**: Process is being initialized
2. **Ready**: Process is ready to execute
3. **Running**: Process is currently executing
4. **Blocked**: Process is waiting for I/O or event
5. **Zombie**: Process has exited but parent hasn't called wait()

### Context Switch
- Save current register state to PCB
- Restore next process register state from PCB
- Update stack pointer and page tables
- Flush TLB if necessary

### Scheduling
- Round-robin scheduling is acceptable minimum
- Priority scheduling is preferred
- Time quantum: typically 10-100ms
- Scheduler called on: timer interrupt, syscall block, process exit

### fork() Semantics
- Create exact copy of parent process
- Child gets new PID, parent's PID becomes child's PPID
- Child gets copy of file descriptors (shared offset)
- Copy-on-write optimization recommended
- Returns 0 to child, child's PID to parent

### exec() Semantics
- Replace current process image with new program
- File descriptors remain open (unless FD_CLOEXEC set)
- PID and PPID unchanged
- Stack, heap, and data segments replaced

### wait() Semantics
- Parent blocks until child exits
- Returns child's PID and exit status
- Supports WNOHANG for non-blocking check
