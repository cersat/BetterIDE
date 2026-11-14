// Reads the JEDEC ID of an SPI flash chip (W25Qxx and the like) and compares the speed of
// fastpins::SpiDevice::write() with a loop of SPI.transfer().
// Wiring: the chip on the hardware SPI pins of the board, its chip select on the SS pin.

#include <FastSPI.h>

fastpins::SpiDevice<SS, 4000000UL, MSBFIRST, SPI_MODE0> flash;

uint8_t buffer[256];

void setup() {
	Serial.begin(115200);
	while (!Serial && millis() < 3000) {
	}
	flash.begin();

	flash.select();
	flash.transfer(0x9F); // Read JEDEC ID
	uint8_t id[3];
	flash.read(id, sizeof(id));
	flash.deselect();
	Serial.print(F("JEDEC ID:"));
	for (uint8_t i = 0; i < sizeof(id); i++) {
		Serial.print(' ');
		Serial.print(id[i], HEX);
	}
	Serial.println();

	for (uint16_t i = 0; i < sizeof(buffer); i++) {
		buffer[i] = i;
	}

	// Nothing is written to the flash: without a page program command, the chip ignores the bytes.
	flash.select();
	uint32_t start = micros();
	for (uint16_t i = 0; i < sizeof(buffer); i++) {
		SPI.transfer(buffer[i]);
	}
	uint32_t loopTime = micros() - start;
	start = micros();
	flash.write(buffer, sizeof(buffer));
	uint32_t writeTime = micros() - start;
	flash.deselect();

	Serial.print(F("256 bytes, SPI.transfer() loop: "));
	Serial.print(loopTime);
	Serial.println(F(" us"));
	Serial.print(F("256 bytes, write(): "));
	Serial.print(writeTime);
	Serial.println(F(" us"));
}

void loop() {
}
