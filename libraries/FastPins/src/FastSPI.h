/*
 * FastSPI: a device on the hardware SPI bus, with its chip select pin fixed at compile time.
 *
 * The chip select is switched with FastPins (one instruction on the supported boards), the settings are fixed at
 * compile time, and write() sends a buffer without overwriting it, with the fastest way the core has:
 *  - AVR: a loop on the SPI registers that loads the next byte while the current one is shifted out,
 *  - ESP32: SPI.writeBytes() through the FIFO of the SPI peripheral,
 *  - RP2040/RP2350 (arduino-pico): the transmit-only transfer of the Pico SDK,
 *  - other boards: SPI.transfer() byte by byte.
 *
 * License: LGPL-2.1-or-later, like FastPins.
 */
#pragma once

#include <SPI.h>
#include <string.h>
#include "FastPins.h"

namespace fastpins {
namespace spi_detail {

#if defined(SPDR) && defined(SPSR) && defined(SPIF)
// AVR: the next byte is loaded while the current one is shifted out, nothing is read back.
FASTPINS_INLINE void write(const uint8_t *data, size_t count, bool) {
	if (!count) {
		return;
	}
	SPDR = *data++;
	while (--count) {
		const uint8_t next = *data++;
		while (!(SPSR & _BV(SPIF))) {
		}
		SPDR = next;
	}
	while (!(SPSR & _BV(SPIF))) {
	}
	(void)SPDR; // Clears SPIF, like after SPI.transfer().
}
#elif defined(ARDUINO_ARCH_ESP32)
FASTPINS_INLINE void write(const uint8_t *data, size_t count, bool) {
	SPI.writeBytes(data, count);
}
#elif defined(ARDUINO_ARCH_RP2040)
FASTPINS_INLINE void write(const uint8_t *data, size_t count, bool msbFirst) {
	if (msbFirst) {
		// Transmit only, with the Pico SDK. arduino-pico supports it only with the most significant bit first.
		SPI.transfer(data, nullptr, count);
		return;
	}
	while (count--) {
		SPI.transfer(*data++);
	}
}
#else
FASTPINS_INLINE void write(const uint8_t *data, size_t count, bool) {
	while (count--) {
		SPI.transfer(*data++);
	}
}
#endif

} // namespace spi_detail

/**
 * A device on the hardware SPI bus (`SPI`), selected with the chip select pin `CsPin` (active low).
 *
 *   fastpins::SpiDevice<10> flash;                              // 4 MHz, MSBFIRST, SPI_MODE0
 *   fastpins::SpiDevice<9, 8000000, MSBFIRST, SPI_MODE3> display;
 *
 *   flash.begin();                     // once, in setup()
 *   flash.select();                    // starts a transaction and pulls the chip select low
 *   flash.transfer(0x9F);
 *   uint8_t id = flash.transfer(0x00);
 *   flash.deselect();                  // releases the chip select and ends the transaction
 *
 * Between select() and deselect(), other code must not use the SPI bus.
 */
template <uint8_t CsPin, uint32_t Clock = 4000000UL, decltype(MSBFIRST) Order = MSBFIRST,
	decltype(SPI_MODE0) Mode = SPI_MODE0>
struct SpiDevice {
	using ChipSelect = Pin<CsPin>;

	/**
	 * Sets the chip select up as a high (inactive) output and starts the SPI bus.
	 */
	static inline void begin() {
		ChipSelect::high();
		ChipSelect::output();
		ChipSelect::high(); // pinMode resets the output level on some cores.
		SPI.begin();
	}

	static inline void select() {
		SPI.beginTransaction(SPISettings(Clock, Order, Mode));
		ChipSelect::low();
	}

	static inline void deselect() {
		ChipSelect::high();
		SPI.endTransaction();
	}

	/**
	 * Sends a byte and returns the byte received at the same time.
	 */
	static inline uint8_t transfer(uint8_t value) {
		return SPI.transfer(value);
	}

	static inline uint16_t transfer16(uint16_t value) {
		return SPI.transfer16(value);
	}

	/**
	 * Sends the buffer and replaces its content with the received bytes.
	 */
	static inline void transfer(void *buffer, size_t count) {
		SPI.transfer(buffer, count);
	}

	/**
	 * Sends `count` bytes and leaves the buffer as it is. The received bytes are dropped.
	 */
	static inline void write(const void *data, size_t count) {
		spi_detail::write(static_cast<const uint8_t *>(data), count, Order == MSBFIRST);
	}

	/**
	 * Receives `count` bytes into the buffer, sending `fill` for each of them.
	 */
	static inline void read(void *buffer, size_t count, uint8_t fill = 0xFF) {
		memset(buffer, fill, count);
		SPI.transfer(buffer, count);
	}
};

} // namespace fastpins
