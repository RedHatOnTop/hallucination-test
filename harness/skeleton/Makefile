CROSS_COMPILE = i686-elf
CC = $(CROSS_COMPILE)-gcc
LD = $(CROSS_COMPILE)-ld
OBJCOPY = $(CROSS_COMPILE)-objcopy

CFLAGS = -m32 -ffreestanding -nostdlib -nostdinc -fno-builtin -fno-stack-protector -nostartfiles -nodefaultlibs -Wall -Wextra
LDFLAGS = -T linker.ld -nostdlib

SRCS = boot/boot.s
OBJS = $(SRCS:.s=.o)
OBJS += $(SRCS:.c=.o)

TARGET = kernel.bin

all: $(TARGET)

$(TARGET): $(OBJS)
	$(LD) $(LDFLAGS) -o $@ $^
	$(OBJCOPY) -O binary $@ kernel.raw

%.o: %.s
	$(CC) $(CFLAGS) -c -o $@ $<

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(TARGET) kernel.raw

.PHONY: all clean
