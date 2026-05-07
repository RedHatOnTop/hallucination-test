# Intel i686 (x86 32-bit) Architecture Reference

## Register Set

### General Purpose Registers (32-bit)
- EAX: Accumulator (return values, multiplication)
- EBX: Base register (preserved across function calls)
- ECX: Counter register (loop counter, shift count)
- EDX: Data register (I/O, multiplication extension)
- ESI: Source index (string operations source)
- EDI: Destination index (string operations destination)
- EBP: Base pointer (stack frame base)
- ESP: Stack pointer (top of stack)

### Segment Registers (16-bit)
- CS: Code segment
- DS: Data segment
- ES: Extra segment
- FS: General purpose segment
- GS: General purpose segment
- SS: Stack segment

### Control Registers
- CR0: System control flags (protected mode, paging enable)
- CR2: Page fault linear address
- CR3: Page directory base address
- CR4: Extended control flags

### System Registers
- IDTR: Interrupt Descriptor Table register
- GDTR: Global Descriptor Table register
- LDTR: Local Descriptor Table register
- TR: Task Register
- EFLAGS: Status and control flags
- EIP: Instruction pointer

## Memory Management

### Paging
- 32-bit linear address space (4GB)
- Two-level paging: Page Directory (1024 entries) -> Page Table (1024 entries)
- Page size: 4KB standard, 4MB with CR4.PSE
- Page Directory Entry (PDE): contains page table base address
- Page Table Entry (PTE): contains physical frame address
- PDE/PTE flags: Present, Read/Write, User/Supervisor, Write-Through, Cache Disable, Accessed, Dirty, Page Size, Global

### GDT Entry Format
- Base address (32-bit)
- Segment limit (20-bit)
- Access byte: Present, DPL, Descriptor type, Executable, Direction/Conforming, Read/Write, Accessed
- Flags: Granularity, Size (16/32-bit)

## Interrupt Handling

### IDT Entry Format
- Offset (31:16), Offset (15:0)
- Segment selector
- Type/attributes: Present, DPL, Gate type (interrupt, trap, task)

### Interrupt Numbers
- 0-19: CPU exceptions (divide error, debug, NMI, breakpoint, overflow, bounds, invalid opcode, device not available, double fault, coprocessor segment overrun, invalid TSS, segment not present, stack segment fault, general protection fault, page fault, reserved, x87 FPU error, alignment check, machine check)
- 32-255: User-defined interrupts
- 0x80: Common syscall interrupt number (128)

## I/O Ports
- IN/OUT instructions for port I/O
- 8-bit, 16-bit, and 32-bit port access
- Common ports: 0x60 (keyboard), 0x3F8 (COM1 serial), 0x3E8 (COM4)
