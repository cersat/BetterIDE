import {
	StatusBar,
	StatusBarAlignment,
} from '@theia/core/lib/browser/status-bar/status-bar';
import { nls } from '@theia/core/lib/common/nls';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Sketch } from '../../common/protocol';
import { CurrentSketch } from '../sketches-service-client-impl';
import { CoreServiceContribution } from './contribution';

const STATUS_BAR_ID = 'arduino-compile-target';
/**
 * When there are more additional files than this, only their number is shown (the tooltip lists all of them).
 */
const MAX_LISTED_FILES = 3;

/**
 * Shows in the status bar what Verify/Upload will compile for the active editor:
 * the main `.ino` and the `.c`, `.cpp`, `.h` files of the sketch, or only an `.ino` outside of the sketch,
 * and that the upload is not available when the active file is not an `.ino`.
 */
@injectable()
export class CompileTargetStatus extends CoreServiceContribution {
	@inject(StatusBar)
	private readonly statusBar: StatusBar;

	override onStart(): void {
		this.editorManager.onCurrentEditorChanged(() => this.update());
		this.sketchServiceClient.onCurrentSketchDidChange(() => this.update());
	}

	override onReady(): void {
		this.update();
	}

	private async update(): Promise<void> {
		const sketch = await this.sketchServiceClient.currentSketch();
		if (!CurrentSketch.isValid(sketch)) {
			this.statusBar.removeElement(STATUS_BAR_ID);
			return;
		}
		const { mainFileUri, mainFileOnly, uploadable } = this.compileTarget(sketch);
		const mainFile = new URI(mainFileUri).path.base;
		const additionalFiles = mainFileOnly ? [] : this.additionalCodeFiles(sketch);

		let files = mainFile;
		if (mainFileOnly) {
			files += ` ${nls.localize('arduino/compileTarget/onlyThisFile', '(only this file)')}`;
		} else if (additionalFiles.length > MAX_LISTED_FILES) {
			files += ` + ${nls.localize(
				'arduino/compileTarget/moreFiles',
				'{0} files',
				additionalFiles.length
			)}`;
		} else if (additionalFiles.length) {
			files += ` + ${additionalFiles.join(' + ')}`;
		}

		const tooltipLines = [
			nls.localize('arduino/compileTarget/tooltip', 'Verify and Upload compile:'),
			mainFile,
			...additionalFiles,
		];
		if (!uploadable) {
			tooltipLines.push(
				'',
				nls.localize(
					'arduino/compileTarget/uploadUnavailable',
					'Upload is not available: open an .ino file to upload it.'
				)
			);
		}

		this.statusBar.setElement(STATUS_BAR_ID, {
			alignment: StatusBarAlignment.LEFT,
			text: `${uploadable ? '$(file-code)' : '$(circle-slash)'} ${files}`,
			tooltip: tooltipLines.join('\n'),
			priority: 100,
		});
	}

	/**
	 * The `.c`, `.cpp`, `.h`, etc. files compiled together with the main file, relative to the sketch folder.
	 */
	private additionalCodeFiles(sketch: Sketch): string[] {
		const sketchUri = new URI(sketch.uri);
		return sketch.additionalFileUris
			.filter((uri) => Sketch.Extensions.CODE_FILES.some((ext) => uri.endsWith(ext)))
			.map((uri) => sketchUri.relative(new URI(uri))?.toString() ?? new URI(uri).path.base)
			.sort((left, right) => left.localeCompare(right));
	}
}
