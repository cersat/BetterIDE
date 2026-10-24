import { promises as fs } from 'fs';
import * as path from 'path';
import { injectable } from '@theia/core/shared/inversify';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { FileSystemExt } from '../common/protocol/filesystem-ext';

@injectable()
export class NodeFileSystemExt implements FileSystemExt {
	async getUri(fsPath: string): Promise<string> {
		return FileUri.create(fsPath).toString();
	}

	async setLibrariesFolder(
		sketchbookFsPath: string,
		librariesFsPath: string
	): Promise<string | undefined> {
		const link = path.join(sketchbookFsPath, 'libraries');
		const target = librariesFsPath ? path.resolve(librariesFsPath) : '';
		const useDefault = !target || path.resolve(link) === target;

		const stat = await fs.lstat(link).catch(() => undefined);
		let movedTo: string | undefined;
		if (stat?.isSymbolicLink()) {
			if (!useDefault && (await sameFolder(link, target))) {
				return undefined;
			}
			await fs.unlink(link);
		} else if (stat) {
			if (useDefault) {
				return undefined;
			}
			if ((await fs.readdir(link)).length) {
				movedTo = await freeName(`${link}_old`);
				await fs.rename(link, movedTo);
			} else {
				await fs.rmdir(link);
			}
		}

		if (useDefault) {
			await fs.mkdir(link, { recursive: true });
			return movedTo;
		}
		await fs.mkdir(target, { recursive: true });
		await fs.mkdir(sketchbookFsPath, { recursive: true });
		// A junction does not need administrator rights on Windows.
		await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
		return movedTo;
	}
}

async function sameFolder(a: string, b: string): Promise<boolean> {
	try {
		return (await fs.realpath(a)) === (await fs.realpath(b));
	} catch {
		return false;
	}
}

async function freeName(base: string): Promise<string> {
	let candidate = base;
	for (let i = 2; await fs.lstat(candidate).then(() => true, () => false); i++) {
		candidate = `${base}${i}`;
	}
	return candidate;
}
