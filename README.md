# BetterIDE

BetterIDE is a fork of the [Arduino IDE 2.x](https://github.com/arduino/arduino-ide) with a few things changed to make everyday work less annoying. It is built on the [Theia](https://theia-ide.org/) framework and [Electron](https://www.electronjs.org/); compilation and uploading are done by [arduino-cli](https://github.com/arduino/arduino-cli) running as a daemon, as in the original.

## What is different

- **Any file as a tab.** `File → Open File as Tab…` (`Ctrl+Alt+O`) opens any file in place as an editor tab, nothing is copied into the sketch folder.
- **One window.** Starting the IDE a second time opens its sketch as tabs of the already running window instead of a new window. `File → Open…`, recent sketches, the sketchbook and examples open as tabs too.
- **Editable local files.** Files outside the open sketch (opened as tabs or dropped into the editor) are no longer read-only. Only `sketch.json` and cloud `thingProperties.h` stay protected.
- **Compile the active tab.** Verify and Upload compile the `.ino` of the active tab with the `.c`, `.cpp` and `.h` files of the sketch, without the other `.ino` files. An `.ino` outside of the sketch is compiled alone. When a non-`.ino` file is active, Upload is not available. The status bar shows what will be compiled. This needs a patched `arduino-cli` ([`arduino-cli-betteride.patch`](arduino-ide-extension/scripts/arduino-cli-betteride.patch), built by `download-cli`; adds `--main-file` and `--main-file-only` to `arduino-cli compile`).
- **A board for every `.ino`.** The selected board and port are remembered for every `.ino` file and selected again when its tab becomes active.
- **CLI terminal.** `Tools → Arduino CLI Terminal` (`Ctrl+Alt+T`, `Ctrl+Alt+J` on Linux) opens a terminal in the bottom panel next to the Output, with `arduino-cli` on the `PATH` and the IDE's own CLI configuration.
- **More settings** in `File → Preferences`:
  - show or hide the hints that appear when hovering over code;
  - show suggestions after special characters (`.`, `->`);
  - auto-close brackets and quotes;
  - offer updates on startup (the dialog with the changelog and the update button);
  - the libraries folder, `<sketchbook>/libraries` by default. Libraries are installed to and searched in the chosen folder. Libraries that were in the previous folder are not moved, the IDE warns you to reinstall or move them by hand;
  - show cloud sketches.
- **No `Advanced` submenu.** `Keyboard Shortcuts` is in the `File` menu.
- **Updates from this repository.** The IDE checks the latest [release](../../releases) here instead of the Arduino servers.

## Download

Builds are published on the [Releases](../../releases) page. Every push to `main` produces a new one.

| System | File | Notes |
| --- | --- | --- |
| Windows | `…_Windows_64bit.exe` | portable, no installation |
| Windows | `…_Windows_64bit_setup.exe` | installer, can update itself |
| Windows | `…_Windows_64bit.zip` | unpack and run `Arduino IDE.exe` |
| Linux | `…_Linux_64bit.AppImage` | `chmod +x` it and run, add `--no-sandbox` if the sandbox is not set up |
| Linux | `…_Linux_64bit.zip` | unpack and run `arduino-ide` |

The Windows and Linux builds are made by [GitHub Actions](.github/workflows/build.yml). The version looks like `2.3.11-build.N`, where `N` grows with every build.

## FastPins

[`libraries/FastPins`](libraries/FastPins) is a library of fast `digitalWrite`, `digitalRead` and `pinMode` for pins known at compile time: one or two instructions on the AVR boards, the standard functions elsewhere. `FastPins.zip` is attached to every release.

## Building from source

Node.js 20, yarn 1, `git` and Go (for the patched `arduino-cli`) are needed. The workflow in [`.github/workflows/build.yml`](.github/workflows/build.yml) is the reference for the exact steps and the system packages for each platform. In short:

```
yarn --ignore-scripts
yarn --cwd arduino-ide-extension prepare
yarn --cwd arduino-ide-extension build
yarn --cwd electron-app rebuild
yarn --cwd electron-app build
yarn --cwd electron-app package
```

The workflow also installs the Electron binary and `ripgrep`, builds the `@theia/ffmpeg` addon (and `@vscode/windows-ca-certs` on Windows), and limits the memory of the webpack step. The technical overview of the application is in the [development guide](docs/development.md).

## License

The code in this repository is licensed under the terms of the GNU AGPLv3, like the Arduino IDE it is based on. The executable distributions contain third-party code licensed under other compatible licenses such as GPLv2, MIT and BSD-3. BetterIDE is not made or supported by Arduino. Arduino is a trademark of its owner.
