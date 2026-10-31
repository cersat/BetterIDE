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

## Installing

BetterIDE comes with FastPins: just `#include <FastPins.h>`. A FastPins installed in the sketchbook takes precedence.

In another IDE, copy the `FastPins` folder into the `libraries` folder of your sketchbook, or use
*Sketch → Include Library → Add .ZIP Library…* with `FastPins.zip` from the BetterIDE releases.
