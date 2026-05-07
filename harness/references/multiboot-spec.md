# Multiboot Specification

## Header Format

The Multiboot header must be contained within the first 8192 bytes of the OS image.

### Required Fields
- Magic number: `0x1BADB002`
- Flags: features requested/required by the OS
  - Bit 0: Align loaded modules on page boundaries
  - Bit 1: Provide memory map information
  - Bit 2: Provide video mode information
  - Bits 3-15: Reserved (must be zero)
  - Bit 16: Request bootloader to use linear graphics mode
- Checksum: `-(magic + flags)` (32-bit unsigned)

## Boot Information

Upon boot, the bootloader provides a structure via EBX register:

### Multiboot Info Structure
- Flags: indicate which fields are valid
- Mem_lower: amount of lower memory (KB)
- Mem_upper: amount of upper memory (KB)
- Boot_device: boot device
- Cmdline: kernel command line
- Mods_count: number of loaded modules
- Mods_addr: address of module structures
- Syms: ELF section header table info
- Mmap_length: memory map size
- Mmap_addr: memory map address
- Drives_length: drives info size
- Drives_addr: drives info address
- Config_table: ROM configuration table
- Boot_loader_name: bootloader name string
- Apm_table: APM table
- Vbe_control_info: VBE control info
- Vbe_mode_info: VBE mode info

## Machine State at Boot

When the bootloader transfers control to the kernel:
- EAX: `0x2BADB002` (magic value)
- EBX: Physical address of multiboot info structure
- CS: 32-bit code segment with base 0 and limit 4GB
- DS, ES, FS, GS, SS: 32-bit data segment with base 0 and limit 4GB
- A20 gate: enabled
- Paging: disabled
- Interrupts: disabled (IF flag cleared)
- EFLAGS: VM and IF flags cleared

## Entry Point

The kernel entry point is determined by the ELF entry point field.
