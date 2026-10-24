import { open } from '@theia/core/lib/browser/opener-service';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { nls } from '@theia/core/lib/common/nls';
import { inject, injectable } from '@theia/core/shared/inversify';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { ArduinoMenus } from '../menu/arduino-menus';
import {
	Command,
	CommandRegistry,
	KeybindingRegistry,
	MenuModelRegistry,
	SketchContribution,
	URI,
} from './contribution';

/**
 * Opens any file as an editor tab, in place: nothing is copied into the sketch folder
 * (unlike `Add File...`). The command accepts file URIs too, so other contributions
 * (e.g. a second IDE instance handing its files over) can reuse it.
 */
@injectable()
export class OpenFileAsTab extends SketchContribution {
	@inject(FileDialogService)
	private readonly fileDialogService: FileDialogService;

	override registerCommands(registry: CommandRegistry): void {
		registry.registerCommand(OpenFileAsTab.Commands.OPEN_FILE_AS_TAB, {
			execute: (uris?: URI | string | Array<URI | string>) =>
				this.openFilesAsTabs(uris),
		});
		registry.registerCommand(OpenFileAsTab.Commands.OPEN_SKETCH_AS_TABS, {
			execute: (sketchFsPath: string) => this.openSketchAsTabs(sketchFsPath),
		});
	}

	override registerMenus(registry: MenuModelRegistry): void {
		registry.registerMenuAction(
			ArduinoMenus.SKETCH_CONTROL__CONTEXT__MAIN_GROUP,
			{
				commandId: OpenFileAsTab.Commands.OPEN_FILE_AS_TAB.id,
				label:
					nls.localize('arduino/contributions/openFileAsTab', 'Open File as Tab') +
					'...',
				order: '1',
			}
		);
	}

	override registerKeybindings(registry: KeybindingRegistry): void {
		registry.registerKeybinding({
			command: OpenFileAsTab.Commands.OPEN_FILE_AS_TAB.id,
			keybinding: 'CtrlCmd+Alt+O',
		});
	}

	/**
	 * Used when another IDE instance is launched with a sketch: instead of opening a new window,
	 * the electron main process hands the sketch folder to this window, and its files become tabs here.
	 * The sketch this window works on (verify/upload target) does not change.
	 */
	private async openSketchAsTabs(sketchFsPath: string): Promise<void> {
		try {
			const sketch = await this.sketchesService.loadSketch(
				FileUri.create(sketchFsPath).toString()
			);
			const { mainFileUri, rootFolderFileUris } = sketch;
			await this.openFilesAsTabs([mainFileUri, ...rootFolderFileUris]);
			// No new window opens the sketch, so it has to be added to `Open Recent` here. Temp sketches (examples) are skipped by the service.
			this.sketchesService.markAsRecentlyOpened(sketch.uri);
		} catch (err) {
			this.messageService.error(
				nls.localize(
					'arduino/contributions/openSketchAsTabsFailed',
					"Could not open the sketch '{0}' as tabs: {1}",
					sketchFsPath,
					err instanceof Error ? err.message : String(err)
				)
			);
		}
	}

	private async openFilesAsTabs(
		uris?: URI | string | Array<URI | string>
	): Promise<void> {
		let toOpen: URI[];
		if (uris) {
			const list = Array.isArray(uris) ? uris : [uris];
			toOpen = list.map((u) => (typeof u === 'string' ? new URI(u) : u));
		} else {
			const picked = await this.fileDialogService.showOpenDialog({
				title: nls.localize('arduino/contributions/openFileAsTab', 'Open File as Tab'),
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: true,
				modal: true,
			});
			if (!picked) {
				return;
			}
			toOpen = Array.isArray(picked) ? picked : [picked];
		}
		for (const uri of toOpen) {
			try {
				await open(this.openerService, uri, { mode: 'activate', preview: false });
			} catch (err) {
				this.messageService.error(
					nls.localize(
						'arduino/contributions/openFileAsTabFailed',
						"Could not open '{0}' as a tab: {1}",
						uri.path.base,
						err instanceof Error ? err.message : String(err)
					)
				);
			}
		}
	}
}

export namespace OpenFileAsTab {
	export namespace Commands {
		export const OPEN_FILE_AS_TAB: Command = {
			id: 'arduino-open-file-as-tab',
		};
		export const OPEN_SKETCH_AS_TABS: Command = {
			id: 'arduino-open-sketch-as-tabs',
		};
	}
}
