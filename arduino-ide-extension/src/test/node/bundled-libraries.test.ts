import { expect } from 'chai';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import temp from 'temp';
import { installBundledLibraries } from '../../node/bundled-libraries';

describe('installBundledLibraries', () => {
	let tracked: typeof temp;
	let bundledDir: string;
	let targetDir: string;

	before(() => (tracked = temp.track()));
	beforeEach(async () => {
		bundledDir = tracked.mkdirSync();
		targetDir = join(tracked.mkdirSync(), 'libraries');
		await writeLibrary(bundledDir, 'FastPins', '1.1.0', 'new');
	});
	after(() => tracked.cleanupSync());

	async function writeLibrary(dir: string, name: string, version: string, content: string) {
		await fs.mkdir(join(dir, name, 'src'), { recursive: true });
		await fs.writeFile(join(dir, name, 'library.properties'), `name=${name}\nversion=${version}\n`);
		await fs.writeFile(join(dir, name, 'src', `${name}.h`), content);
	}

	const header = () => fs.readFile(join(targetDir, 'FastPins', 'src', 'FastPins.h'), 'utf8');

	it('should copy a missing library', async () => {
		expect(await installBundledLibraries(bundledDir, targetDir)).to.be.deep.equal(['FastPins']);
		expect(await header()).to.be.equal('new');
	});

	it('should keep a library with the same version', async () => {
		await writeLibrary(targetDir, 'FastPins', '1.1.0', 'kept');
		expect(await installBundledLibraries(bundledDir, targetDir)).to.be.deep.equal([]);
		expect(await header()).to.be.equal('kept');
	});

	it('should replace a library with another version, without leftovers', async () => {
		await writeLibrary(targetDir, 'FastPins', '1.0.0', 'old');
		await fs.writeFile(join(targetDir, 'FastPins', 'stale.txt'), '');
		expect(await installBundledLibraries(bundledDir, targetDir)).to.be.deep.equal(['FastPins']);
		expect(await header()).to.be.equal('new');
		const stale = await fs.stat(join(targetDir, 'FastPins', 'stale.txt')).catch(() => undefined);
		expect(stale).to.be.undefined;
	});

	it('should not touch the other libraries of the folder', async () => {
		await writeLibrary(targetDir, 'Arduino_BuiltIn', '1.0.0', 'other');
		await installBundledLibraries(bundledDir, targetDir);
		const other = await fs.readFile(join(targetDir, 'Arduino_BuiltIn', 'src', 'Arduino_BuiltIn.h'), 'utf8');
		expect(other).to.be.equal('other');
	});

	it('should do nothing without bundled libraries', async () => {
		expect(await installBundledLibraries(join(bundledDir, 'missing'), targetDir)).to.be.deep.equal([]);
	});
});
