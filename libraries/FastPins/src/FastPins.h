/*
 * FastPins: digitalWrite, digitalRead and pinMode for pin numbers known at compile time,
 * each compiled to one or two instructions instead of the table lookups of the Arduino functions.
 *
 * Supported: the AVR boards of the Arduino AVR core (Uno, Nano, Mega, Leonardo, Micro, ...), the ESP32 chips of the
 * arduino-esp32 core and the RP2040/RP2350 boards of the arduino-pico core.
 * On any other board, everything falls back to the standard Arduino functions, so sketches stay portable.
 *
 * Unlike digitalWrite, the fast functions do not turn off a PWM output (analogWrite) on the pin, and the pin has to be
 * set up as an output first (with fastPinMode, pinMode or Pin<N>::output()).
 *
 * License: LGPL-2.1-or-later, like the Arduino AVR core the pin tables come from.
 */
#pragma once

#include <Arduino.h>

#if defined(ARDUINO_ARCH_ESP32)
#include "soc/gpio_reg.h"
#include "soc/soc_caps.h"
#elif defined(ARDUINO_ARCH_RP2040)
#include "hardware/structs/sio.h"
#endif

#define FASTPINS_INLINE inline __attribute__((always_inline))

// The types of the values of digitalWrite and pinMode: `int` on the AVR core, the `PinStatus` and `PinMode` enums
// on the cores built on ArduinoCore-API (mbed, SAMD, Renesas, arduino-pico, ...).
#define FASTPINS_PIN_STATUS(value) static_cast<decltype(HIGH)>(value)
#define FASTPINS_PIN_MODE(value) static_cast<decltype(OUTPUT)>(value)

namespace fastpins {
namespace detail {

#if defined(ARDUINO_AVR_UNO) || defined(ARDUINO_AVR_DUEMILANOVE) || defined(ARDUINO_AVR_NANO) || defined(ARDUINO_AVR_MINI) || defined(ARDUINO_AVR_FIO) || defined(ARDUINO_AVR_BT) || defined(ARDUINO_AVR_PRO) || defined(ARDUINO_AVR_LILYPAD) || defined(ARDUINO_AVR_NG) || defined(ARDUINO_AVR_UNO_WIFI_DEV_ED)
// Uno, Nano, Mini, Pro, Duemilanove and other ATmega328P/168 boards ("standard" variant)
#define FASTPINS_SUPPORTED 1
#define FASTPINS_AVR 1
	// Arduino port numbers (PA = 1, PB = 2, ... PL = 12) of the digital pins, from the core's pins_arduino.h.
	constexpr uint8_t kPort[] = {
		4, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 3, 3,
		3, 3, 3, 3,
	};
	// Bit numbers of the digital pins in their port.
	constexpr uint8_t kBit[] = {
		0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 0, 1,
		2, 3, 4, 5,
	};
#elif defined(ARDUINO_AVR_MEGA2560) || defined(ARDUINO_AVR_MEGA) || defined(ARDUINO_AVR_ADK)
// Mega 2560, Mega 1280, Mega ADK ("mega" variant)
#define FASTPINS_SUPPORTED 1
#define FASTPINS_AVR 1
	// Arduino port numbers (PA = 1, PB = 2, ... PL = 12) of the digital pins, from the core's pins_arduino.h.
	constexpr uint8_t kPort[] = {
		5, 5, 5, 5, 7, 5, 8, 8, 8, 8, 2, 2, 2, 2, 10, 10,
		8, 8, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3,
		3, 3, 3, 3, 3, 3, 4, 7, 7, 7, 12, 12, 12, 12, 12, 12,
		12, 12, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 11, 11,
		11, 11, 11, 11, 11, 11,
	};
	// Bit numbers of the digital pins in their port.
	constexpr uint8_t kBit[] = {
		0, 1, 4, 5, 5, 3, 3, 4, 5, 6, 4, 5, 6, 7, 1, 0,
		1, 0, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 7, 6,
		5, 4, 3, 2, 1, 0, 7, 2, 1, 0, 7, 6, 5, 4, 3, 2,
		1, 0, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 0, 1,
		2, 3, 4, 5, 6, 7,
	};
#elif defined(ARDUINO_AVR_LEONARDO) || defined(ARDUINO_AVR_LEONARDO_ETH) || defined(ARDUINO_AVR_MICRO) || defined(ARDUINO_AVR_ESPLORA) || defined(ARDUINO_AVR_LILYPAD_USB) || defined(ARDUINO_AVR_YUN) || defined(ARDUINO_AVR_YUNMINI) || defined(ARDUINO_AVR_INDUSTRIAL101) || defined(ARDUINO_AVR_LININO_ONE)
// Leonardo, Micro, Esplora, Yún and other ATmega32U4 boards ("leonardo" variant)
#define FASTPINS_SUPPORTED 1
#define FASTPINS_AVR 1
	// Arduino port numbers (PA = 1, PB = 2, ... PL = 12) of the digital pins, from the core's pins_arduino.h.
	constexpr uint8_t kPort[] = {
		4, 4, 4, 4, 4, 3, 4, 5, 2, 2, 2, 2, 4, 3, 2, 2,
		2, 2, 6, 6, 6, 6, 6, 6, 4, 4, 2, 2, 2, 4, 4,
	};
	// Bit numbers of the digital pins in their port.
	constexpr uint8_t kBit[] = {
		2, 3, 1, 0, 4, 6, 7, 6, 4, 5, 6, 7, 6, 7, 3, 1,
		2, 0, 7, 6, 5, 4, 1, 0, 4, 7, 4, 5, 6, 6, 5,
	};
#endif

#ifdef FASTPINS_AVR

constexpr uint8_t kPinCount = sizeof(kPort);

// The registers of an Arduino port number. With a constant port number the switch disappears.
FASTPINS_INLINE volatile uint8_t &outputRegister(uint8_t port) {
	switch (port) {
#ifdef PORTA
	case 1: return PORTA;
#endif
#ifdef PORTB
	case 2: return PORTB;
#endif
#ifdef PORTC
	case 3: return PORTC;
#endif
#ifdef PORTD
	case 4: return PORTD;
#endif
#ifdef PORTE
	case 5: return PORTE;
#endif
#ifdef PORTF
	case 6: return PORTF;
#endif
#ifdef PORTG
	case 7: return PORTG;
#endif
#ifdef PORTH
	case 8: return PORTH;
#endif
#ifdef PORTJ
	case 10: return PORTJ;
#endif
#ifdef PORTK
	case 11: return PORTK;
#endif
#ifdef PORTL
	case 12: return PORTL;
#endif
	}
	__builtin_unreachable();
}

FASTPINS_INLINE volatile uint8_t &modeRegister(uint8_t port) {
	switch (port) {
#ifdef DDRA
	case 1: return DDRA;
#endif
#ifdef DDRB
	case 2: return DDRB;
#endif
#ifdef DDRC
	case 3: return DDRC;
#endif
#ifdef DDRD
	case 4: return DDRD;
#endif
#ifdef DDRE
	case 5: return DDRE;
#endif
#ifdef DDRF
	case 6: return DDRF;
#endif
#ifdef DDRG
	case 7: return DDRG;
#endif
#ifdef DDRH
	case 8: return DDRH;
#endif
#ifdef DDRJ
	case 10: return DDRJ;
#endif
#ifdef DDRK
	case 11: return DDRK;
#endif
#ifdef DDRL
	case 12: return DDRL;
#endif
	}
	__builtin_unreachable();
}

FASTPINS_INLINE volatile uint8_t &inputRegister(uint8_t port) {
	switch (port) {
#ifdef PINA
	case 1: return PINA;
#endif
#ifdef PINB
	case 2: return PINB;
#endif
#ifdef PINC
	case 3: return PINC;
#endif
#ifdef PIND
	case 4: return PIND;
#endif
#ifdef PINE
	case 5: return PINE;
#endif
#ifdef PINF
	case 6: return PINF;
#endif
#ifdef PING
	case 7: return PING;
#endif
#ifdef PINH
	case 8: return PINH;
#endif
#ifdef PINJ
	case 10: return PINJ;
#endif
#ifdef PINK
	case 11: return PINK;
#endif
#ifdef PINL
	case 12: return PINL;
#endif
	}
	__builtin_unreachable();
}

// Registers in the low I/O space are changed with a single sbi/cbi instruction, which cannot be interrupted.
// The others (PORTH..PORTL on the Mega) need a read-modify-write, done with interrupts disabled,
// so an interrupt handler changing another pin of the same port is not undone.
FASTPINS_INLINE bool isBitAddressable(volatile uint8_t &reg) {
	return reinterpret_cast<uintptr_t>(&reg) < 0x40;
}

FASTPINS_INLINE void setBits(volatile uint8_t &reg, uint8_t mask) {
	if (isBitAddressable(reg)) {
		reg |= mask;
	} else {
		const uint8_t sreg = SREG;
		cli();
		reg |= mask;
		SREG = sreg;
	}
}

FASTPINS_INLINE void clearBits(volatile uint8_t &reg, uint8_t mask) {
	if (isBitAddressable(reg)) {
		reg &= static_cast<uint8_t>(~mask);
	} else {
		const uint8_t sreg = SREG;
		cli();
		reg &= static_cast<uint8_t>(~mask);
		SREG = sreg;
	}
}

FASTPINS_INLINE void write(uint8_t pin, uint8_t value) {
	if (value == LOW) {
		clearBits(outputRegister(kPort[pin]), 1 << kBit[pin]);
	} else {
		setBits(outputRegister(kPort[pin]), 1 << kBit[pin]);
	}
}

FASTPINS_INLINE int read(uint8_t pin) {
	return (inputRegister(kPort[pin]) & (1 << kBit[pin])) ? HIGH : LOW;
}

FASTPINS_INLINE void toggle(uint8_t pin) {
#if defined(__AVR_ATmega8__)
	// The ATmega8 cannot toggle a pin by writing its PIN register.
	const uint8_t sreg = SREG;
	cli();
	outputRegister(kPort[pin]) ^= 1 << kBit[pin];
	SREG = sreg;
#else
	// Writing a one to a PIN register bit toggles the output, in one instruction.
	inputRegister(kPort[pin]) = 1 << kBit[pin];
#endif
}

FASTPINS_INLINE void mode(uint8_t pin, uint8_t pinMode) {
	const uint8_t mask = 1 << kBit[pin];
	volatile uint8_t &ddr = modeRegister(kPort[pin]);
	volatile uint8_t &out = outputRegister(kPort[pin]);
	if (pinMode == OUTPUT) {
		setBits(ddr, mask);
	} else {
		const uint8_t sreg = SREG;
		cli();
		ddr &= static_cast<uint8_t>(~mask);
		if (pinMode == INPUT_PULLUP) {
			out |= mask;
		} else {
			out &= static_cast<uint8_t>(~mask);
		}
		SREG = sreg;
	}
}

#endif // FASTPINS_AVR

#if !defined(FASTPINS_SUPPORTED) && defined(ARDUINO_ARCH_ESP32) && \
	!(defined(BOARD_HAS_PIN_REMAP) && !defined(BOARD_USES_HW_GPIO_NUMBERS))
// ESP32 (all the chips of the arduino-esp32 core). The pin numbers are the GPIO numbers.
// Boards that number the pins differently (BOARD_HAS_PIN_REMAP, such as the Arduino Nano ESP32) use the fallback.
#define FASTPINS_SUPPORTED 1
#define FASTPINS_ESP32 1

constexpr uint8_t kPinCount = SOC_GPIO_PIN_COUNT;

FASTPINS_INLINE volatile uint32_t &reg(uint32_t address) {
	return *reinterpret_cast<volatile uint32_t *>(address);
}

// The W1TS ("write 1 to set") and W1TC ("write 1 to clear") registers change only the given bits,
// with a single store that cannot be interrupted.
FASTPINS_INLINE void write(uint8_t pin, uint8_t value) {
	if (pin < 32) {
		reg(value == LOW ? GPIO_OUT_W1TC_REG : GPIO_OUT_W1TS_REG) = 1UL << pin;
	}
#ifdef GPIO_OUT1_W1TS_REG
	else {
		reg(value == LOW ? GPIO_OUT1_W1TC_REG : GPIO_OUT1_W1TS_REG) = 1UL << (pin - 32);
	}
#endif
}

FASTPINS_INLINE int read(uint8_t pin) {
	if (pin < 32) {
		return (reg(GPIO_IN_REG) >> pin) & 1 ? HIGH : LOW;
	}
#ifdef GPIO_IN1_REG
	return (reg(GPIO_IN1_REG) >> (pin - 32)) & 1 ? HIGH : LOW;
#else
	return LOW;
#endif
}

FASTPINS_INLINE void toggle(uint8_t pin) {
	if (pin < 32) {
		write(pin, (reg(GPIO_OUT_REG) >> pin) & 1 ? LOW : HIGH);
	}
#ifdef GPIO_OUT1_REG
	else {
		write(pin, (reg(GPIO_OUT1_REG) >> (pin - 32)) & 1 ? LOW : HIGH);
	}
#endif
}

// The pin mode is set up rarely: the core function also routes the pin to the GPIO matrix.
FASTPINS_INLINE void mode(uint8_t pin, uint8_t pinMode) {
	::pinMode(pin, FASTPINS_PIN_MODE(pinMode));
}
#endif // ESP32

#if !defined(FASTPINS_SUPPORTED) && defined(ARDUINO_ARCH_RP2040)
// RP2040 and RP2350 (the arduino-pico core). The pin numbers are the GPIO numbers.
#define FASTPINS_SUPPORTED 1
#define FASTPINS_RP2040 1

constexpr uint8_t kPinCount = __GPIOCNT;

// The SIO set, clear and toggle registers change only the given bits, with a single store.
FASTPINS_INLINE void write(uint8_t pin, uint8_t value) {
	if (pin < 32) {
		if (value == LOW) {
			sio_hw->gpio_clr = 1UL << pin;
		} else {
			sio_hw->gpio_set = 1UL << pin;
		}
	}
#if __GPIOCNT > 32
	else if (value == LOW) {
		sio_hw->gpio_hi_clr = 1UL << (pin - 32);
	} else {
		sio_hw->gpio_hi_set = 1UL << (pin - 32);
	}
#endif
}

FASTPINS_INLINE int read(uint8_t pin) {
#if __GPIOCNT > 32
	if (pin >= 32) {
		return (sio_hw->gpio_hi_in >> (pin - 32)) & 1 ? HIGH : LOW;
	}
#endif
	return (sio_hw->gpio_in >> pin) & 1 ? HIGH : LOW;
}

FASTPINS_INLINE void toggle(uint8_t pin) {
#if __GPIOCNT > 32
	if (pin >= 32) {
		sio_hw->gpio_hi_togl = 1UL << (pin - 32);
		return;
	}
#endif
	sio_hw->gpio_togl = 1UL << pin;
}

// The pin mode is set up rarely: the core function also selects the SIO function and the pads.
FASTPINS_INLINE void mode(uint8_t pin, uint8_t pinMode) {
	::pinMode(pin, FASTPINS_PIN_MODE(pinMode));
}
#endif // RP2040

} // namespace detail

/**
 * A digital pin with its number fixed at compile time: `fastpins::Pin<13> led;` then `led.high()`.
 * Using a pin the board does not have is a compile error.
 */
template <uint8_t Number>
struct Pin {
#ifdef FASTPINS_SUPPORTED
	static_assert(Number < detail::kPinCount, "FastPins: this board has no such digital pin");
#endif
	static constexpr uint8_t number = Number;

	static inline void output() { mode(OUTPUT); }
	static inline void input() { mode(INPUT); }
	static inline void inputPullup() { mode(INPUT_PULLUP); }

	static inline void mode(uint8_t pinMode) {
#ifdef FASTPINS_SUPPORTED
		detail::mode(Number, pinMode);
#else
		::pinMode(Number, FASTPINS_PIN_MODE(pinMode));
#endif
	}

	static inline void write(uint8_t value) {
#ifdef FASTPINS_SUPPORTED
		detail::write(Number, value);
#else
		::digitalWrite(Number, FASTPINS_PIN_STATUS(value));
#endif
	}

	static inline void high() { write(HIGH); }
	static inline void low() { write(LOW); }

	static inline void toggle() {
#ifdef FASTPINS_SUPPORTED
		detail::toggle(Number);
#else
		::digitalWrite(Number, ::digitalRead(Number) == HIGH ? LOW : HIGH);
#endif
	}

	static inline int read() {
#ifdef FASTPINS_SUPPORTED
		return detail::read(Number);
#else
		return ::digitalRead(Number);
#endif
	}
};

} // namespace fastpins

/*
 * Drop-in replacements of digitalWrite, digitalRead and pinMode. They are fast when the pin number is a
 * compile-time constant (a literal, a constexpr or a #define) on a supported board, and call the standard
 * Arduino function otherwise.
 */
#ifdef FASTPINS_SUPPORTED
#define FASTPINS_IS_FAST(pin) (__builtin_constant_p(pin) && (pin) < fastpins::detail::kPinCount)
#define fastDigitalWrite(pin, value) \
	(FASTPINS_IS_FAST(pin) ? fastpins::detail::write((pin), (value)) : ::digitalWrite((pin), (value)))
#define fastDigitalRead(pin) \
	(FASTPINS_IS_FAST(pin) ? fastpins::detail::read(pin) : ::digitalRead(pin))
#define fastPinMode(pin, pinModeValue) \
	(FASTPINS_IS_FAST(pin) ? fastpins::detail::mode((pin), (pinModeValue)) : ::pinMode((pin), (pinModeValue)))
#define fastDigitalToggle(pin) \
	(FASTPINS_IS_FAST(pin) ? fastpins::detail::toggle(pin) : ::digitalWrite((pin), ::digitalRead(pin) == HIGH ? LOW : HIGH))
#else
#define fastDigitalWrite(pin, value) ::digitalWrite((pin), (value))
#define fastDigitalRead(pin) ::digitalRead(pin)
#define fastPinMode(pin, pinModeValue) ::pinMode((pin), (pinModeValue))
#define fastDigitalToggle(pin) ::digitalWrite((pin), ::digitalRead(pin) == HIGH ? LOW : HIGH)
#endif
