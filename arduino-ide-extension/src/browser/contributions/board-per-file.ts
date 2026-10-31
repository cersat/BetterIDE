import { Deferred } from '@theia/core/lib/common/promise-util';
import { injectable } from '@theia/core/shared/inversify';
import type {
	BoardIdentifier,
	BoardsConfig,
	PortIdentifier,
} from '../../common/protocol/boards-service';
import { CurrentSketch } from '../sketches-service-client-impl';
import { CoreServiceContribution } from './contribution';

const STORAGE_KEY = 'betteride-board-per-main-file';

interface StoredBoardsConfig {
	readonly selectedBoard?: BoardIdentifier;
	readonly selectedPort?: PortIdentifier;
}

/**
 * Remembers the selected board and port for every `.ino` file, and selects them again when the file becomes the one
 * Verify/Upload compiles (see `compileTarget`). A file that has no board yet takes the currently selected one.
 */
@injectable()
export class BoardPerFile extends CoreServiceContribution {
	/**
	 * The URI of the `.ino` file the current board selection belongs to.
	 */
	private currentMainFileUri: string | undefined;
	/**
	 * `true` while this contribution selects a stored board, so the change is not stored again.
	 */
	private applying = false;
	private readonly ready = new Deferred<void>();

	override onStart(): void {
		this.editorManager.onCurrentEditorChanged(() => this.mainFileMightChange());
		this.sketchServiceClient.onCurrentSketchDidChange(() => this.mainFileMightChange());
		this.boardsServiceProvider.onBoardsConfigDidChange(() => this.boardsConfigDidChange());
	}

	override async onReady(): Promise<void> {
		try {
			// Wait for the board selection restored from the previous session.
			await this.boardsServiceProvider.ready;
		} finally {
			this.ready.resolve();
		}
		await this.mainFileMightChange();
	}

	private async mainFileMightChange(): Promise<void> {
		await this.ready.promise;
		const sketch = await this.sketchServiceClient.currentSketch();
		if (!CurrentSketch.isValid(sketch)) {
			return;
		}
		const { mainFileUri } = this.compileTarget(sketch);
		if (mainFileUri === this.currentMainFileUri) {
			return;
		}
		this.currentMainFileUri = mainFileUri;
		// Read again every time: other windows store boards too.
		const stored = load()[mainFileUri];
		if (stored) {
			this.select(stored);
		} else {
			this.remember(mainFileUri);
		}
	}

	private select({ selectedBoard, selectedPort }: StoredBoardsConfig): void {
		this.applying = true;
		try {
			if (selectedBoard && selectedPort) {
				this.boardsServiceProvider.updateConfig({ selectedBoard, selectedPort });
			} else if (selectedBoard) {
				this.boardsServiceProvider.updateConfig(selectedBoard);
			} else if (selectedPort) {
				this.boardsServiceProvider.updateConfig(selectedPort);
			}
		} finally {
			this.applying = false;
		}
	}

	private boardsConfigDidChange(): void {
		if (this.applying || !this.currentMainFileUri) {
			return;
		}
		this.remember(this.currentMainFileUri);
	}

	private remember(mainFileUri: string): void {
		const { selectedBoard, selectedPort } = this.boardsServiceProvider.boardsConfig;
		save({ ...load(), [mainFileUri]: toStored({ selectedBoard, selectedPort }) });
	}
}

/**
 * The boards are stored in the local storage of the application, not of the window (the Theia `StorageService`
 * scopes its data to the sketch of the window), so a file has its board in any window.
 */
function load(): Record<string, StoredBoardsConfig> {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const configs = raw ? JSON.parse(raw) : undefined;
		return configs && typeof configs === 'object' ? configs : {};
	} catch {
		return {};
	}
}

function save(configs: Record<string, StoredBoardsConfig>): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
	} catch (err) {
		console.warn('Could not store the boards of the files.', err);
	}
}

/**
 * Only the identifying properties are stored.
 */
function toStored({ selectedBoard, selectedPort }: BoardsConfig): StoredBoardsConfig {
	return {
		selectedBoard: selectedBoard
			? { name: selectedBoard.name, fqbn: selectedBoard.fqbn }
			: undefined,
		selectedPort: selectedPort
			? { protocol: selectedPort.protocol, address: selectedPort.address }
			: undefined,
	};
}
