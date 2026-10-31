import { FileUri } from '@theia/core/lib/common/file-uri';
import { nls } from '@theia/core/lib/common/nls';
import { isOSX, isWindows } from '@theia/core/lib/common/os';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { ExecutableService } from '../../common/protocol/executable-service';
import { ArduinoMenus } from '../menu/arduino-menus';
import { CurrentSketch } from '../sketches-service-client-impl';
import {
	Command,
	CommandRegistry,
	KeybindingRegistry,
	MenuModelRegistry,
	SketchContribution,
	URI,
} from './contribution';

/**
 * The name of the config file the IDE's `arduino-cli daemon` runs with (`~/.arduinoIDE/arduino-cli.yaml`).
 * The same name is used by the backend, but that module cannot be imported from the browser code.
 */
const CLI_CONFIG = 'arduino-cli.yaml';

/**
 * A terminal in the bottom panel (next to the `Output`) which is the command line version of the IDE:
 * the `arduino-cli` bundled with the IDE is on the `PATH` and it runs with the very same config file as the IDE,
 * so the boards, the libraries and the settings are shared between the IDE and the terminal.
 */
@injectable()
export class ArduinoCliTerminal extends SketchContribution {
	@inject(TerminalService)
	private readonly terminalService: TerminalService;
	@inject(ExecutableService)
	private readonly executableService: ExecutableService;

	override registerCommands(registry: CommandRegistry): void {
		registry.registerCommand(ArduinoCliTerminal.Commands.OPEN_ARDUINO_CLI_TERMINAL, {
			execute: () => this.openTerminal(),
		});
	}

	override registerMenus(registry: MenuModelRegistry): void {
		registry.registerMenuAction(ArduinoMenus.TOOLS__MAIN_GROUP, {
			commandId: ArduinoCliTerminal.Commands.OPEN_ARDUINO_CLI_TERMINAL.id,
			label: nls.localize('arduino/contributions/cliTerminal', 'Arduino CLI Terminal'),
			order: '9',
		});
	}

	override registerKeybindings(registry: KeybindingRegistry): void {
		registry.registerKeybinding({
			command: ArduinoCliTerminal.Commands.OPEN_ARDUINO_CLI_TERMINAL.id,
			// On Linux, the desktop takes Ctrl+Alt+T to open its own terminal: the IDE never receives it.
			keybinding: isWindows || isOSX ? 'CtrlCmd+Alt+T' : 'CtrlCmd+Alt+J',
		});
	}

	private async openTerminal(): Promise<void> {
		const existing = this.terminalService.getById(ArduinoCliTerminal.WIDGET_ID);
		if (existing) {
			this.terminalService.open(existing, { mode: 'activate' });
			return;
		}
		const [{ cliUri }, configDirUri, variables, sketch] = await Promise.all([
			this.executableService.list(),
			this.envVariableServer.getConfigDirUri(),
			this.envVariableServer.getVariables(),
			this.sketchServiceClient.currentSketch(),
		]);

		// Prepend the folder of the bundled CLI to the PATH. The env var name is `Path` on Windows.
		const cliDir = FileUri.fsPath(new URI(cliUri).parent);
		const pathVariable = variables.find(
			({ name }) => name.toLowerCase() === 'path'
		);
		const pathName = pathVariable?.name ?? 'PATH';
		const delimiter = isWindows ? ';' : ':';
		const path = pathVariable?.value
			? `${cliDir}${delimiter}${pathVariable.value}`
			: cliDir;

		const terminal = await this.terminalService.newTerminal({
			id: ArduinoCliTerminal.WIDGET_ID,
			title: nls.localize('arduino/contributions/cliTerminalTitle', 'Arduino CLI'),
			cwd: CurrentSketch.isValid(sketch) ? new URI(sketch.uri) : undefined,
			env: {
				[pathName]: path,
				ARDUINO_CONFIG_FILE: FileUri.fsPath(
					new URI(configDirUri).resolve(CLI_CONFIG)
				),
			},
			destroyTermOnClose: true,
			useServerTitle: false,
		});
		await terminal.start();
		this.terminalService.open(terminal, { mode: 'activate' });
	}
}

export namespace ArduinoCliTerminal {
	export const WIDGET_ID = 'arduino-cli-terminal';
	export namespace Commands {
		export const OPEN_ARDUINO_CLI_TERMINAL: Command = {
			id: 'arduino-open-cli-terminal',
		};
	}
}
