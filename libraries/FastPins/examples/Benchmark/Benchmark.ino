// Compares how long 10000 writes take with digitalWrite and with FastPins.
// Open the Serial Monitor at 115200 baud.
#include <FastPins.h>

constexpr uint8_t PIN = LED_BUILTIN;
constexpr unsigned int COUNT = 10000;

void setup() {
	Serial.begin(115200);
	pinMode(PIN, OUTPUT);

	unsigned long start = micros();
	for (unsigned int i = 0; i < COUNT; i++) {
		digitalWrite(PIN, HIGH);
		digitalWrite(PIN, LOW);
	}
	const unsigned long arduino = micros() - start;

	start = micros();
	for (unsigned int i = 0; i < COUNT; i++) {
		fastDigitalWrite(PIN, HIGH);
		fastDigitalWrite(PIN, LOW);
	}
	const unsigned long fast = micros() - start;

	Serial.print(F("digitalWrite:     "));
	Serial.print(arduino);
	Serial.println(F(" us"));
	Serial.print(F("fastDigitalWrite: "));
	Serial.print(fast);
	Serial.println(F(" us"));
}

void loop() {
}
