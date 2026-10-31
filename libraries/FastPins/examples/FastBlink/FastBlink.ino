// Blinks the built-in LED with FastPins.
#include <FastPins.h>

fastpins::Pin<LED_BUILTIN> led;

void setup() {
	led.output();
}

void loop() {
	led.toggle();
	delay(500);
}
