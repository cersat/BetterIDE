# FastPins

`digitalWrite`, `digitalRead` and `pinMode` for pin numbers known at compile time. On the AVR boards each call
compiles to one or two instructions (`sbi`/`cbi`/`in`/`out`), instead of the table lookups and the PWM check of
the Arduino functions.

Supported boards: the boards of the Arduino AVR core with the `standard`, `mega` and `leonardo` pin layouts
(Uno, Nano, Mini, Pro, Duemilanove, Mega 2560/1280/ADK, Leonardo, Micro, Esplora, Yún, ...). On every other
board the same code compiles to the standard Arduino functions, so a sketch stays portable.

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

- A PWM output (`analogWrite`) on the pin is not turned off by `write`. Call `digitalWrite` once, or
  `analogWrite(pin, 0)`, before using the pin as a plain output.
- On the Mega, the ports H, J, K and L are outside of the bit-addressable I/O space: a write there takes a few
  instructions with interrupts disabled for a moment, like the Arduino function does.

## Installing

Copy the `FastPins` folder into the `libraries` folder of your sketchbook, or use
*Sketch → Include Library → Add .ZIP Library…* with `FastPins.zip` from the BetterIDE releases.
