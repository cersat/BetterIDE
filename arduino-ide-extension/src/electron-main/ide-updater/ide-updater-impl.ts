import { injectable } from '@theia/core/shared/inversify';
import { UpdateInfo, CancellationToken, autoUpdater } from 'electron-updater';
import fetch from 'node-fetch';
import {
  IDEUpdater,
  IDEUpdaterClient,
} from '../../common/protocol/ide-updater';

// Matches e.g. `https://github.com/{owner}/{repo}/releases/latest/download`.
const GITHUB_RELEASES_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\//;

@injectable()
export class IDEUpdaterImpl implements IDEUpdater {
  private isAlreadyChecked = false;
  private baseUrl = '';
  private updater = autoUpdater;
  private cancellationToken?: CancellationToken;
  protected theiaFEClient?: IDEUpdaterClient;
  protected clients: Array<IDEUpdaterClient> = [];

  constructor() {
    this.updater.on('checking-for-update', (e) => {
      this.clients.forEach((c) => c.notifyCheckedForUpdate(e));
    });
    this.updater.on('update-available', (e) => {
      this.clients.forEach((c) => c.notifyUpdateAvailableFound(e));
    });
    this.updater.on('update-not-available', (e) => {
      this.clients.forEach((c) => c.notifyUpdateAvailableNotFound(e));
    });
    this.updater.on('download-progress', (e) => {
      this.clients.forEach((c) => c.notifyDownloadProgressChanged(e));
    });
    this.updater.on('update-downloaded', (e) => {
      this.clients.forEach((c) => c.notifyDownloadFinished(e));
    });
    this.updater.on('error', (e) => {
      this.clients.forEach((c) => c.notifyUpdaterFailed(e));
    });
  }

  async init(baseUrl: string): Promise<void> {
    this.baseUrl = baseUrl;
    this.updater.autoDownload = false;
    this.updater.channel = 'latest';
    this.updater.setFeedURL({
      provider: 'generic',
      url: baseUrl,
      channel: 'latest',
    });
  }

  setClient(client: IDEUpdaterClient | undefined): void {
    if (client) this.clients.push(client);
  }

  async checkForUpdates(initialCheck?: boolean): Promise<UpdateInfo | void> {
    if (initialCheck) {
      if (this.isAlreadyChecked) return Promise.resolve();
      this.isAlreadyChecked = true;
    }

    const { updateInfo, cancellationToken } =
      await this.updater.checkForUpdates();

    this.cancellationToken = cancellationToken;
    if (this.updater.currentVersion.compare(updateInfo.version) === -1) {
      try {
        updateInfo.releaseNotes = await this.fetchReleaseNotes();
      } catch {
        /*
          if the request for the release notes fails, we'll just avoid to show them
          to the user, but we will still show the update info
        */
      }
      return updateInfo;
    }
  }

  /**
   * The release notes are the description of the latest GitHub release of the repository the updates come from.
   */
  private async fetchReleaseNotes(): Promise<string | null> {
    const match = GITHUB_RELEASES_URL.exec(this.baseUrl);
    if (!match) {
      return null;
    }
    const [, owner, repo] = match;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    );
    if (!response.ok) {
      return null;
    }
    const { body } = (await response.json()) as { body?: string | null };
    return body || null;
  }

  async downloadUpdate(): Promise<void> {
    try {
      await this.updater.downloadUpdate(this.cancellationToken);
    } catch (e) {
      if (e.message === 'cancelled') return;
      this.clients.forEach((c) => c.notifyUpdaterFailed(e));
    }
  }

  stopDownload(): void {
    this.cancellationToken?.cancel();
  }

  quitAndInstall(): void {
    this.updater.quitAndInstall();
  }

  disconnectClient(client: IDEUpdaterClient): void {
    const index = this.clients.indexOf(client);
    if (index !== -1) {
      this.clients.splice(index, 1);
    }
  }

  dispose(): void {
    this.clients.forEach(this.disconnectClient.bind(this));
  }
}
