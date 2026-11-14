# FastPins

`digitalWrite`, `digitalRead` and `pinMode` for pin numbers known at compile time. Each write or read compiles to
one or two instructions, instead of the table lookups and checks of the Arduino functions.

| Boards | How |
| --- | --- |
| Arduino AVR core: Uno, Nano, Mini, Pro, Duemilanove, Mega 2560/1280/ADK, Leonardo, Micro, Esplora, Yún, ... | `sbi`/`cbi` on the port registers, a toggle is one write to the `PIN` register |
| arduino-esp32 core: ESP32, S2, S3, C3, C6, H2, P4, ... | one store to the `GPIO_OUT_W1TS`/`W1TC` registers |
| arduino-pico core: RP2040 and RP2350 boards (Raspberry Pi Pico, Pico 2, ...) | one store to the SIO set, clear and toggle registers |

On every other board, and on boards that number their pins differently from the GPIOs (the Arduino Nano ESP32 with
its default pin numbering, the Arduino mbed cores), the same code compiles to the standard Arduino functions, so a
sketch stays portable. `pinMode` uses the core function on the ESP32 and the RP2040: it is called rarely, and it also
routes the pin to the GPIO.

## Usage

```cpp
#include <FastPins.h>

fastpins::Pin<LED_BUILTIN> led;
fastpins::Pin<2> button;

void setup() {
	led.output();
	button.inputPullup();
}

void loop() {
	led.write(button.read());
	led.toggle();
}
```

`fastpins::Pin<N>` has `output()`, `input()`, `inputPullup()`, `mode(m)`, `high()`, `low()`, `write(v)`,
`toggle()` and `read()`. A pin number the board does not have is a compile error.

The drop-in macros `fastDigitalWrite(pin, value)`, `fastDigitalRead(pin)`, `fastPinMode(pin, mode)` and
`fastDigitalToggle(pin)` are fast when `pin` is a compile-time constant (a literal, a `constexpr` or a `#define`)
and call the Arduino function otherwise.

## Differences from the Arduino functions

- A PWM output (`analogWrite`) on the pin is not turned off by `write`. Call `pinMode(pin, OUTPUT)` again before using
  the pin as a plain output.
- Set the pin up as an output (`output()`, `fastPinMode` or `pinMode`) before writing it. On the RP2040, `digitalWrite`
  on an `INPUT_PULLUP` pin drives it like an open-drain output; the fast write only sets the output level.
- On the Mega, the ports H, J, K and L are outside of the bit-addressable I/O space: a write there takes a few
  instructions with interrupts disabled for a moment, like the Arduino function does.

## Hardware SPI

`FastSPI.h` adds a device on the hardware SPI bus (`SPI`) with its chip select pin and settings fixed at compile time.
The chip select is switched with FastPins, and `write()` sends a buffer without overwriting it:

| Boards | `write()` |
| --- | --- |
| AVR | a loop on the SPI registers that loads the next byte while the current one is shifted out |
| ESP32 | `SPI.writeBytes()`, through the FIFO of the SPI peripheral |
| RP2040, RP2350 | the transmit-only transfer of the Pico SDK (`MSBFIRST`; with `LSBFIRST`, byte by byte) |
| other boards | `SPI.transfer()` byte by byte |

```cpp
#include <FastSPI.h>

fastpins::SpiDevice<10> flash;                              // 4 MHz, MSBFIRST, SPI_MODE0
fastpins::SpiDevice<9, 8000000, MSBFIRST, SPI_MODE3> display;

void setup() {
	flash.begin();
	display.begin();
}

void loop() {
	flash.select();
	flash.transfer(0x9F);
	uint8_t id[3];
	flash.read(id, sizeof(id));
	flash.deselect();
}
```

`fastpins::SpiDevice<CS, Clock, Order, Mode>` has:

- `begin()`: sets the chip select up as a high output and starts the bus, once in `setup()`,
- `select()` / `deselect()`: `SPI.beginTransaction()` with the device's settings and the chip select low, then the
  chip select high and `SPI.endTransaction()`,
- `transfer(byte)` and `transfer16(value)`: return the received data,
- `transfer(buffer, count)`: replaces the buffer with the received bytes,
- `write(data, count)`: sends only, the buffer can be `const`,
- `read(buffer, count, fill = 0xFF)`: receives `count` bytes, sending `fill`.

Between `select()` and `deselect()`, other code must not use the bus. The example *SpiFlashId* reads the ID of an SPI
flash chip and compares `write()` with a loop of `SPI.transfer()`.

## Installing

BetterIDE comes with FastPins: just `#include <FastPins.h>` or `#include <FastSPI.h>`. A FastPins installed in the sketchbook takes precedence.

In another IDE, copy the `FastPins` folder into the `libraries` folder of your sketchbook, or use
*Sketch → Include Library → Add .ZIP Library…* with `FastPins.zip` from the BetterIDE releases.
