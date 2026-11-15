import { Navigatable } from '@theia/core/lib/browser/navigatable';
import { SaveableSource } from '@theia/core/lib/browser/saveable';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import URI from '@theia/core/lib/common/uri';
import { injectable } from '@theia/core/shared/inversify';
import { FilesystemSaveableService as TheiaFilesystemSaveableService } from '@theia/filesystem/lib/browser/filesystem-saveable-service';

@injectable()
export class FilesystemSaveableService extends TheiaFilesystemSaveableService {
	/**
	 * Theia's "Save As" without its dialog: writes the current content of `widget` to `target` (overwriting it),
	 * reverts the unsaved changes of the original file and opens `target` in the place of `widget`.
	 */
	saveTo(
		widget: Widget & SaveableSource & Navigatable,
		target: URI
	): Promise<void> {
		return this.saveSnapshot(widget, target, true);
	}
}
