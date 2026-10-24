// @ts-check

(async () => {
  const path = require('path');
  const semver = require('semver');
  const moment = require('moment');
  const downloader = require('./downloader');
  const { taskBuildFromGit, exec } = require('./utils');

  const patch = (() => {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    return pkg?.arduino?.['arduino-cli']?.patch;
  })();

  const version = (() => {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    if (!pkg) {
      return undefined;
    }

    const { arduino } = pkg;
    if (!arduino) {
      return undefined;
    }

    const cli = arduino['arduino-cli'];
    if (!cli) {
      return undefined;
    }

    const { version } = cli;
    return version;
  })();

  if (!version) {
    console.log(`Could not retrieve CLI version info from the 'package.json'.`);
    process.exit(1);
  }

  const { platform, arch } = process;
  const resourcesFolder = path.join(
    __dirname,
    '..',
    'src',
    'node',
    'resources'
  );
  const cliName = `arduino-cli${platform === 'win32' ? '.exe' : ''}`;
  const destinationPath = path.join(resourcesFolder, cliName);

  if (typeof version === 'string' && patch) {
    buildPatchedCli(version, patch, destinationPath);
    return;
  }

  if (typeof version === 'string') {
    const suffix = (() => {
      switch (platform) {
        case 'darwin':
          if (arch === 'arm64') {
            return 'macOS_ARM64.tar.gz';
          }
          return 'macOS_64bit.tar.gz';
        case 'win32':
          return 'Windows_64bit.zip';
        case 'linux': {
          switch (arch) {
            case 'arm':
              return 'Linux_ARMv7.tar.gz';
            case 'arm64':
              return 'Linux_ARM64.tar.gz';
            case 'x64':
              return 'Linux_64bit.tar.gz';
            default:
              return undefined;
          }
        }
        default:
          return undefined;
      }
    })();
    if (!suffix) {
      console.log(`The CLI is not available for ${platform} ${arch}.`);
      process.exit(1);
    }
    if (semver.valid(version)) {
      const url = `https://downloads.arduino.cc/arduino-cli/arduino-cli_${version}_${suffix}`;
      console.log(
        `📦  Identified released version of the CLI. Downloading version ${version} from '${url}'`
      );
      await downloader.downloadUnzipFile(url, destinationPath, 'arduino-cli');
    } else if (moment(version, 'YYYYMMDD', true).isValid()) {
      const url = `https://downloads.arduino.cc/arduino-cli/nightly/arduino-cli_nightly-${version}_${suffix}`;
      console.log(
        `🌙  Identified nightly version of the CLI. Downloading version ${version} from '${url}'`
      );
      await downloader.downloadUnzipFile(url, destinationPath, 'arduino-cli');
    } else {
      console.log(`🔥  Could not interpret 'version': ${version}`);
      process.exit(1);
    }
  } else {
    taskBuildFromGit(version, destinationPath, 'CLI');
  }

  /**
   * Builds the CLI from the sources of the `v${version}` tag with the patch applied. Requires `git` and Go.
   * @param {string} version
   * @param {string} patchName the patch file next to this script.
   * @param {string} destinationPath
   */
  function buildPatchedCli(version, patchName, destinationPath) {
    const fs = require('node:fs');
    const os = require('node:os');
    if (fs.existsSync(destinationPath)) {
      console.log(
        `Skipping the CLI build because it already exists: ${destinationPath}`
      );
      return;
    }
    fs.mkdirSync(resourcesFolder, { recursive: true });
    const repoFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-cli-'));
    const tag = `v${version}`;
    console.log(`🔨  Building the CLI ${tag} with '${patchName}'...`);
    exec(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        tag,
        'https://github.com/arduino/arduino-cli.git',
        repoFolder,
      ],
      { logStdout: true }
    );
    exec('git', ['-C', repoFolder, 'apply', path.join(__dirname, patchName)], {
      logStdout: true,
    });
    exec(
      'go',
      [
        'build',
        '-ldflags',
        `-X github.com/arduino/arduino-cli/internal/version.versionString=${version}`,
        '-o',
        destinationPath,
        '.',
      ],
      {
        cwd: repoFolder,
        env: { ...process.env, CGO_ENABLED: '0' },
        logStdout: true,
      }
    );
    fs.rmSync(repoFolder, { recursive: true, force: true, maxRetries: 5 });
    if (!fs.existsSync(destinationPath)) {
      console.log(`Could not build the CLI to ${destinationPath}.`);
      process.exit(1);
    }
    console.log(`Done: ${destinationPath}`);
  }
})();
