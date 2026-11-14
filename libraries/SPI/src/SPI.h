/*
 * SPI library of BetterIDE: replaces the SPI library of the core for every sketch and library that includes <SPI.h>.
 *
 * With arduino-pico 6.3.2 (RP2040, RP2350), it is a faster copy of the library of the core (see rp2040/SPI.h and rp2040/SPIClassRP2040.cpp).
 * With other versions of the core, it is the library of the core, unchanged.
 *
 * License: LGPL-2.1-or-later, like the SPI library of arduino-pico.
 */
#pragma once

#include <Arduino.h>

#if defined(ARDUINO_ARCH_RP2040) && ARDUINO_PICO_MAJOR == 6 && ARDUINO_PICO_MINOR == 3 && ARDUINO_PICO_REVISION == 2
#define BETTERIDE_SPI_RP2040 1
#include "rp2040/SPI.h"
#else
// The SPI library of the core: the include path of the core is cores/<core>, its libraries are next to the cores folder.
#include "../../libraries/SPI/src/SPI.h"
#endif
