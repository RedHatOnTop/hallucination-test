# POSIX File System Interface Specification (POSIX.1-2017)

## VFS Architecture

### Key Concepts
- **Inode**: File system object metadata structure
- **Superblock**: File system metadata (type, size, block size)
- **Dentry**: Directory entry linking name to inode
- **File**: Open file state (position, flags, inode reference)

### Required File Operations
- `open()`, `read()`, `write()`, `close()`, `lseek()`
- `mkdir()`, `rmdir()`, `opendir()`, `readdir()`, `closedir()`

### VFS Layer Interfaces

#### Inode Operations
- `lookup(dir, name)`: Find entry in directory
- `create(dir, name, mode)`: Create new file
- `unlink(dir, name)`: Remove directory entry
- `mkdir(dir, name, mode)`: Create subdirectory
- `rmdir(dir, name)`: Remove subdirectory

#### File Operations
- `read(file, buf, count)`: Read data
- `write(file, buf, count)`: Write data
- `seek(file, offset, whence)`: Set position
- `readdir(file, direntp)`: Read directory entry

### Device Files
- `/dev/console`: System console device
- Device major/minor number scheme
- Character device vs block device

### Mount Points
- Root filesystem mounted at "/"
- Support for mounting additional filesystems
