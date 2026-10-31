import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * The folder name of the CLI's `directories.builtin.libraries` inside the IDE's config folder (`~/.arduinoIDE`).
 * The Arduino IDE does not set this folder, so the `Arduino_BuiltIn` library the IDE installs on the first
 * startup could never be installed. BetterIDE uses a writable folder and keeps its bundled libraries there.
 */
export const BUILTIN_LIBRARIES_FOLDER = 'libraries';

export function builtinLibrariesDir(configDirPath: string): string {
	return join(configDirPath, BUILTIN_LIBRARIES_FOLDER);
}

/**
 * Copies the libraries bundled with the IDE (such as FastPins) into the built-in libraries folder,
 * when a library is missing there or its `version` differs from the bundled one.
 * A library of the same name in the sketchbook still takes precedence when compiling.
 * Resolves with the names of the copied libraries.
 */
export async function installBundledLibraries(
	bundledDir: string,
	targetDir: string
): Promise<string[]> {
	let entries: string[];
	try {
		entries = await fs.readdir(bundledDir);
	} catch {
		return []; // No bundled libraries (for example, when running from the sources without them).
	}
	await fs.mkdir(targetDir, { recursive: true });
	const copied: string[] = [];
	for (const name of entries) {
		const source = join(bundledDir, name);
		const bundledVersion = await libraryVersion(source);
		if (!bundledVersion) {
			continue;
		}
		const target = join(targetDir, name);
		if ((await libraryVersion(target)) === bundledVersion) {
			continue;
		}
		await fs.rm(target, { recursive: true, force: true });
		await fs.cp(source, target, { recursive: true });
		copied.push(name);
	}
	return copied;
}

async function libraryVersion(libraryDir: string): Promise<string | undefined> {
	try {
		const properties = await fs.readFile(join(libraryDir, 'library.properties'), 'utf8');
		return /^version=(.*)$/m.exec(properties)?.[1].trim();
	} catch {
		return undefined;
	}
}
