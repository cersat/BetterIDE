export const FileSystemExtPath = '/services/file-system-ext';
export const FileSystemExt = Symbol('FileSystemExt');
export interface FileSystemExt {
  getUri(fsPath: string): Promise<string>;
  /**
   * The Arduino CLI always keeps the libraries in `<sketchbook>/libraries`.
   * To keep them in another folder, `<sketchbook>/libraries` becomes a link to that folder.
   * An empty `librariesFsPath` restores the default plain `<sketchbook>/libraries` folder.
   * Resolves with the path a non-empty `<sketchbook>/libraries` was renamed to, if it had to make room for the link.
   */
  setLibrariesFolder(
    sketchbookFsPath: string,
    librariesFsPath: string
  ): Promise<string | undefined>;
}
