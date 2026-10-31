/*
 * FastPins: digitalWrite, digitalRead and pinMode for pin numbers known at compile time,
 * each compiled to one or two instructions instead of the table lookups of the Arduino functions.
 *
 * Supported: the AVR boards of the Arduino AVR core (Uno, Nano, Mega, Leonardo, Micro, ...).
 * On any other board, everything falls back to the standard Arduino functions, so sketches stay portable.
 *
 * Unlike digitalWrite, the fast functions do not turn off a PWM output (analogWrite) on the pin.
 *
 * License: LGPL-2.1-or-later, like the Arduino AVR core the pin tables come from.
 */
#pragma once

#include <Arduino.h>

namespace fastpins {
namespace detail {

#if defined(ARDUINO_AVR_UNO) || defined(ARDUINO_AVR_DUEMILANOVE) || defined(ARDUINO_AVR_NANO) || defined(ARDUINO_AVR_MINI) || defined(ARDUINO_AVR_FIO) || defined(ARDUINO_AVR_BT) || defined(ARDUINO_AVR_PRO) || defined(ARDUINO_AVR_LILYPAD) || defined(ARDUINO_AVR_NG) || defined(ARDUINO_AVR_UNO_WIFI_DEV_ED)
// Uno, Nano, Mini, Pro, Duemilanove and other ATmega328P/168 boards ("standard" variant)
#define FASTPINS_SUPPORTED 1
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

#ifdef FASTPINS_SUPPORTED

constexpr uint8_t kPinCount = sizeof(kPort);

#define FASTPINS_INLINE inline __attribute__((always_inline))

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

#endif // FASTPINS_SUPPORTED

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
		::pinMode(Number, pinMode);
#endif
	}

	static inline void write(uint8_t value) {
#ifdef FASTPINS_SUPPORTED
		detail::write(Number, value);
#else
		::digitalWrite(Number, value);
#endif
	}

	static inline void high() { write(HIGH); }
	static inline void low() { write(LOW); }

	static inline void toggle() {
#ifdef FASTPINS_SUPPORTED
		detail::toggle(Number);
#else
		::digitalWrite(Number, !::digitalRead(Number));
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
	(FASTPINS_IS_FAST(pin) ? fastpins::detail::toggle(pin) : ::digitalWrite((pin), !::digitalRead(pin)))
#else
#define fastDigitalWrite(pin, value) ::digitalWrite((pin), (value))
#define fastDigitalRead(pin) ::digitalRead(pin)
#define fastPinMode(pin, pinModeValue) ::pinMode((pin), (pinModeValue))
#define fastDigitalToggle(pin) ::digitalWrite((pin), !::digitalRead(pin))
#endif
