# POSIX System Call Interface Specification (POSIX.1-2017)

## Overview

This document provides the interface specification for the POSIX.1-2017 system calls required for the i686 OS implementation challenge. No implementation code is included.

## Required System Calls (Minimum 20)

### File I/O
- `int open(const char *path, int oflag, ...)`: Open a file
- `int close(int fildes)`: Close a file descriptor
- `ssize_t read(int fildes, void *buf, size_t nbyte)`: Read from file
- `ssize_t write(int fildes, const void *buf, size_t nbyte)`: Write to file
- `off_t lseek(int fildes, off_t offset, int whence)`: Seek in file
- `int stat(const char *restrict path, struct stat *restrict buf)`: Get file status
- `int fstat(int fildes, struct stat *buf)`: Get file status by descriptor

### Process Management
- `pid_t fork(void)`: Create a new process
- `int exec(const char *path, char *const argv[])`: Execute a program
- `pid_t wait(int *stat_loc)`: Wait for process termination
- `void _exit(int status)`: Terminate process
- `pid_t getpid(void)`: Get process ID
- `pid_t getppid(void)`: Get parent process ID

### Directory Operations
- `int chdir(const char *path)`: Change working directory
- `int mkdir(const char *path, mode_t mode)`: Create directory
- `int rmdir(const char *path)`: Remove directory

### Pipe and Duplication
- `int pipe(int fildes[2])`: Create an inter-process channel
- `int dup(int fildes)`: Duplicate file descriptor
- `int dup2(int fildes, int fildes2)`: Duplicate to specific descriptor

### Other
- `unsigned int sleep(unsigned int seconds)`: Sleep for seconds

## POSIX File Descriptor Convention

- File descriptor 0: Standard input (stdin)
- File descriptor 1: Standard output (stdout)
- File descriptor 2: Standard error (stderr)

## Error Handling

System calls return -1 on error and set `errno`. Common error codes:
- `EACCES`: Permission denied
- `ENOENT`: No such file or directory
- `EINVAL`: Invalid argument
- `ENOMEM`: Not enough space
- `EBADF`: Bad file descriptor
