import {
  injectable,
  inject,
  postConstruct,
} from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { Emitter } from '@theia/core/lib/common/event';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { deepClone } from '@theia/core/lib/common/objects';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { MaybePromise } from '@theia/core/lib/common/types';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { PreferenceService, PreferenceScope } from '@theia/core/lib/browser';
import {
  AdditionalUrls,
  CompilerWarnings,
  ConfigService,
  FileSystemExt,
  Network,
} from '../../../common/protocol';
import { CommandService, MessageService, nls } from '@theia/core/lib/common';
import {
  AsyncLocalizationProvider,
  LanguageInfo,
} from '@theia/core/lib/common/i18n/localization';
import { ElectronCommands } from '@theia/core/lib/electron-browser/menu/electron-menu-contribution';
import { DefaultTheme } from '@theia/application-package/lib/application-props';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import type { FileStat } from '@theia/filesystem/lib/common/files';

export const WINDOW_SETTING = 'window';
export const EDITOR_SETTING = 'editor';
export const FONT_SIZE_SETTING = `${EDITOR_SETTING}.fontSize`;
export const AUTO_SAVE_SETTING = `files.autoSave`;
export const QUICK_SUGGESTIONS_SETTING = `${EDITOR_SETTING}.quickSuggestions`;
export const ARDUINO_SETTING = 'arduino';
export const ARDUINO_WINDOW_SETTING = `${ARDUINO_SETTING}.window`;
export const COMPILE_SETTING = `${ARDUINO_SETTING}.compile`;
export const UPLOAD_SETTING = `${ARDUINO_SETTING}.upload`;
export const SKETCHBOOK_SETTING = `${ARDUINO_SETTING}.sketchbook`;
export const AUTO_SCALE_SETTING = `${ARDUINO_WINDOW_SETTING}.autoScale`;
export const ZOOM_LEVEL_SETTING = `${WINDOW_SETTING}.zoomLevel`;
export const COMPILE_VERBOSE_SETTING = `${COMPILE_SETTING}.verbose`;
export const COMPILE_WARNINGS_SETTING = `${COMPILE_SETTING}.warnings`;
export const UPLOAD_VERBOSE_SETTING = `${UPLOAD_SETTING}.verbose`;
export const UPLOAD_VERIFY_SETTING = `${UPLOAD_SETTING}.verify`;
export const SHOW_ALL_FILES_SETTING = `${SKETCHBOOK_SETTING}.showAllFiles`;
export const EDITOR_HOVER_SETTING = `${EDITOR_SETTING}.hover.enabled`;
export const SUGGEST_ON_TRIGGER_CHARACTERS_SETTING = `${EDITOR_SETTING}.suggestOnTriggerCharacters`;
export const AUTO_CLOSING_BRACKETS_SETTING = `${EDITOR_SETTING}.autoClosingBrackets`;
export const AUTO_CLOSING_QUOTES_SETTING = `${EDITOR_SETTING}.autoClosingQuotes`;
export const CHECK_FOR_UPDATES_SETTING = `${ARDUINO_SETTING}.checkForUpdates`;
export const SHOW_CLOUD_SKETCHES_SETTING = `${ARDUINO_SETTING}.cloud.enabled`;
export const LIBRARIES_PATH_SETTING = `${ARDUINO_SETTING}.libraries.path`;

export interface Settings {
  editorFontSize: number; // `editor.fontSize`
  themeId: string; // `workbench.colorTheme`
  autoSave: Settings.AutoSave; // `files.autoSave`
  quickSuggestions: Record<'other' | 'comments' | 'strings', boolean>; // `editor.quickSuggestions`

  languages: (string | LanguageInfo)[]; // `languages from the plugins`
  currentLanguage: string;

  autoScaleInterface: boolean; // `arduino.window.autoScale`
  interfaceScale: number; // `window.zoomLevel`
  verboseOnCompile: boolean; // `arduino.compile.verbose`
  compilerWarnings: CompilerWarnings; // `arduino.compile.warnings`
  verboseOnUpload: boolean; // `arduino.upload.verbose`
  verifyAfterUpload: boolean; // `arduino.upload.verify`
  sketchbookShowAllFiles: boolean; // `arduino.sketchbook.showAllFiles`
  editorHover: boolean; // `editor.hover.enabled`
  suggestOnTriggerCharacters: boolean; // `editor.suggestOnTriggerCharacters`
  autoClosing: boolean; // `editor.autoClosingBrackets` and `editor.autoClosingQuotes`
  checkForUpdates: boolean; // `arduino.checkForUpdates`
  showCloudSketches: boolean; // `arduino.cloud.enabled`
  librariesPath: string; // `arduino.libraries.path`, empty is the default `<sketchbook>/libraries`

  sketchbookPath: string; // CLI
  additionalUrls: AdditionalUrls; // CLI
  network: Network; // CLI
}
export namespace Settings {
  export function belongsToCli<K extends keyof Settings>(key: K): boolean {
    return key === 'sketchbookPath' || key === 'additionalUrls';
  }
  /**
   * The folder libraries are kept in: the chosen one or the default `<sketchbook>/libraries`.
   */
  export function librariesFolder(
    settings: Pick<Settings, 'sketchbookPath' | 'librariesPath'>
  ): string {
    if (settings.librariesPath) {
      return settings.librariesPath;
    }
    const { sketchbookPath } = settings;
    const separator = sketchbookPath.includes('\\') ? '\\' : '/';
    return `${sketchbookPath.replace(/[\\/]+$/, '')}${separator}libraries`;
  }
  export type AutoSave =
    | 'off'
    | 'afterDelay'
    | 'onFocusChange'
    | 'onWindowChange';
  export namespace AutoSave {
    export const DEFAULT_ON: AutoSave = 'afterDelay'; // https://github.com/eclipse-theia/theia/issues/10812
  }
}

@injectable()
export class SettingsService {
  @inject(FileService)
  protected readonly fileService: FileService;

  @inject(FileSystemExt)
  protected readonly fileSystemExt: FileSystemExt;

  @inject(ConfigService)
  protected readonly configService: ConfigService;

  @inject(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @inject(FrontendApplicationStateService)
  protected readonly appStateService: FrontendApplicationStateService;

  @inject(AsyncLocalizationProvider)
  protected readonly localizationProvider: AsyncLocalizationProvider;

  @inject(CommandService)
  protected commandService: CommandService;

  @inject(MessageService)
  private readonly messageService: MessageService;

  @inject(ThemeService)
  private readonly themeService: ThemeService;

  protected readonly onDidChangeEmitter = new Emitter<Readonly<Settings>>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  protected readonly onDidResetEmitter = new Emitter<Readonly<Settings>>();
  readonly onDidReset = this.onDidResetEmitter.event;

  protected ready = new Deferred<void>();
  protected _settings: Settings;
  private loaded: Settings | undefined;

  @postConstruct()
  protected init(): void {
    this.appStateService.reachedState('ready').then(async () => {
      const settings = await this.loadSettings();
      this._settings = deepClone(settings);
      this.loaded = deepClone(settings);
      this.ready.resolve();
    });
    this.preferenceService.onPreferenceChanged(async (event) => {
      await this.ready.promise;
      const { preferenceName, newValue } = event;
      if (
        preferenceName === 'workbench.colorTheme' &&
        typeof newValue === 'string' &&
        this._settings.themeId !== newValue
      ) {
        this.reset();
      }
    });
  }

  protected async loadSettings(): Promise<Settings> {
    await this.preferenceService.ready;
    const [
      languages,
      currentLanguage,
      editorFontSize,
      themeId,
      autoSave,
      quickSuggestions,
      autoScaleInterface,
      interfaceScale,
      verboseOnCompile,
      compilerWarnings,
      verboseOnUpload,
      verifyAfterUpload,
      sketchbookShowAllFiles,
      editorHover,
      suggestOnTriggerCharacters,
      autoClosingBrackets,
      autoClosingQuotes,
      checkForUpdates,
      showCloudSketches,
      librariesPath,
      cliConfig,
    ] = await Promise.all([
      ['en', ...(await this.localizationProvider.getAvailableLanguages())],
      this.localizationProvider.getCurrentLanguage(),
      this.preferenceService.get<number>(FONT_SIZE_SETTING, 12),
      this.preferenceService.get<string>(
        'workbench.colorTheme',
        DefaultTheme.defaultForOSTheme(
          FrontendApplicationConfigProvider.get().defaultTheme
        )
      ),
      this.preferenceService.get<Settings.AutoSave>(
        AUTO_SAVE_SETTING,
        Settings.AutoSave.DEFAULT_ON
      ),
      this.preferenceService.get<
        Record<'other' | 'comments' | 'strings', boolean>
      >(QUICK_SUGGESTIONS_SETTING, {
        other: false,
        comments: false,
        strings: false,
      }),
      this.preferenceService.get<boolean>(AUTO_SCALE_SETTING, true),
      this.preferenceService.get<number>(ZOOM_LEVEL_SETTING, 0),
      this.preferenceService.get<boolean>(COMPILE_VERBOSE_SETTING, true),
      this.preferenceService.get<any>(COMPILE_WARNINGS_SETTING, 'None'),
      this.preferenceService.get<boolean>(UPLOAD_VERBOSE_SETTING, true),
      this.preferenceService.get<boolean>(UPLOAD_VERIFY_SETTING, true),
      this.preferenceService.get<boolean>(SHOW_ALL_FILES_SETTING, false),
      this.preferenceService.get<boolean>(EDITOR_HOVER_SETTING, true),
      this.preferenceService.get<boolean>(
        SUGGEST_ON_TRIGGER_CHARACTERS_SETTING,
        true
      ),
      this.preferenceService.get<string>(
        AUTO_CLOSING_BRACKETS_SETTING,
        'languageDefined'
      ),
      this.preferenceService.get<string>(
        AUTO_CLOSING_QUOTES_SETTING,
        'languageDefined'
      ),
      this.preferenceService.get<boolean>(CHECK_FOR_UPDATES_SETTING, true),
      this.preferenceService.get<boolean>(SHOW_CLOUD_SKETCHES_SETTING, true),
      this.preferenceService.get<string>(LIBRARIES_PATH_SETTING, ''),
      this.configService.getConfiguration(),
    ]);
    const {
      config = {
        additionalUrls: [],
        sketchDirUri: '',
        network: Network.Default(),
      },
    } = cliConfig;
    const { additionalUrls, sketchDirUri, network } = config;

    const sketchbookPath = await this.fileService.fsPath(new URI(sketchDirUri));
    return {
      editorFontSize,
      themeId,
      languages,
      currentLanguage,
      autoSave,
      quickSuggestions,
      autoScaleInterface,
      interfaceScale,
      verboseOnCompile,
      compilerWarnings,
      verboseOnUpload,
      verifyAfterUpload,
      sketchbookShowAllFiles,
      editorHover,
      suggestOnTriggerCharacters,
      autoClosing:
        autoClosingBrackets !== 'never' || autoClosingQuotes !== 'never',
      checkForUpdates,
      showCloudSketches,
      librariesPath,
      additionalUrls,
      sketchbookPath,
      network,
    };
  }

  /**
   * Libraries are not moved: if the previous folder had some, they have to be reinstalled or moved by hand.
   */
  private async warnAboutOldLibraries(
    oldFolder: string | undefined,
    newFolder: string,
    renamedTo: string | undefined
  ): Promise<void> {
    if (!oldFolder || oldFolder === newFolder) {
      return;
    }
    const oldFolderToCheck = renamedTo ?? oldFolder;
    let hadLibraries = false;
    try {
      const stat = await this.fileService.resolve(
        new URI(await this.fileSystemExt.getUri(oldFolderToCheck))
      );
      hadLibraries = !!stat.children?.length;
    } catch {}
    if (!hadLibraries) {
      return;
    }
    this.messageService.warn(
      nls.localize(
        'arduino/preferences/libraries.moved',
        'The libraries folder is now "{0}". The libraries that were in "{1}" were not moved: reinstall them or move them by hand.',
        newFolder,
        oldFolderToCheck
      ),
      'OK'
    );
  }

  async settings(): Promise<Settings> {
    await this.ready.promise;
    return this._settings;
  }

  async update(settings: Settings, fireDidChange = false): Promise<void> {
    await this.ready.promise;
    for (const key of Object.keys(settings)) {
      if (key in this._settings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this._settings as any)[key] = (settings as any)[key];
      }
    }
    if (fireDidChange) {
      this.onDidChangeEmitter.fire(this._settings);
    }
  }

  async reset(): Promise<void> {
    const settings = await this.loadSettings();
    this.loaded = deepClone(settings);
    await this.update(settings, false);
    this.onDidResetEmitter.fire(this._settings);
  }

  async validate(
    settings: MaybePromise<Settings> = this.settings()
  ): Promise<string | true> {
    try {
      const { sketchbookPath, editorFontSize, themeId } = await settings;
      const sketchbookDir = await this.fileSystemExt.getUri(sketchbookPath);
      let sketchbookStat: FileStat | undefined = undefined;
      try {
        sketchbookStat = await this.fileService.resolve(new URI(sketchbookDir));
      } catch {}
      if (!sketchbookStat || !sketchbookStat.isDirectory) {
        return nls.localize(
          'arduino/preferences/invalid.sketchbook.location',
          'Invalid sketchbook location: {0}',
          sketchbookPath
        );
      }
      if (editorFontSize <= 0) {
        return nls.localize(
          'arduino/preferences/invalid.editorFontSize',
          'Invalid editor font size. It must be a positive integer.'
        );
      }
      if (!this.themeService.getThemes().find(({ id }) => id === themeId)) {
        return nls.localize(
          'arduino/preferences/invalid.theme',
          'Invalid theme.'
        );
      }
      return true;
    } catch (err) {
      if (err instanceof Error) {
        return err.message;
      }
      return String(err);
    }
  }

  private async savePreference(name: string, value: unknown): Promise<void> {
    await this.preferenceService.set(name, value, PreferenceScope.User);
  }

  async save(): Promise<string | true> {
    await this.ready.promise;
    const {
      currentLanguage,
      editorFontSize,
      themeId,
      autoSave,
      quickSuggestions,
      autoScaleInterface,
      interfaceScale,
      verboseOnCompile,
      compilerWarnings,
      verboseOnUpload,
      verifyAfterUpload,
      sketchbookPath,
      additionalUrls,
      network,
      sketchbookShowAllFiles,
      editorHover,
      suggestOnTriggerCharacters,
      autoClosing,
      checkForUpdates,
      showCloudSketches,
      librariesPath,
    } = this._settings;
    const [cliConfig, sketchDirUri] = await Promise.all([
      this.configService.getConfiguration(),
      this.fileSystemExt.getUri(sketchbookPath),
    ]);
    const { config } = cliConfig;
    const previous = this.loaded;
    if (!config) {
      // Do not check for any error messages. The config might has errors (such as invalid directories.user) right before saving the new values.
      return nls.localize(
        'arduino/preferences/noCliConfig',
        'Could not load the CLI configuration'
      );
    }

    const updatedConfig: typeof config = {
      ...config,
      additionalUrls,
      sketchDirUri,
      network,
      locale: currentLanguage,
    };

    // Libraries must be in place before the CLI is restarted with the new configuration.
    const oldLibraries = previous
      ? Settings.librariesFolder(previous)
      : undefined;
    const newLibraries = Settings.librariesFolder(this._settings);
    let renamedTo: string | undefined;
    const librariesChanged =
      !previous ||
      previous.sketchbookPath !== sketchbookPath ||
      previous.librariesPath !== librariesPath;
    try {
      if (librariesChanged) {
        renamedTo = await this.fileSystemExt.setLibrariesFolder(
          sketchbookPath,
          librariesPath
        );
      }
    } catch (err) {
      return nls.localize(
        'arduino/preferences/libraries.failed',
        'Could not use "{0}" as the libraries folder: {1}',
        newLibraries,
        err instanceof Error ? err.message : String(err)
      );
    }

    await Promise.all([
      this.savePreference('editor.fontSize', editorFontSize),
      this.savePreference('workbench.colorTheme', themeId),
      this.savePreference(AUTO_SAVE_SETTING, autoSave),
      this.savePreference('editor.quickSuggestions', quickSuggestions),
      this.savePreference(AUTO_SCALE_SETTING, autoScaleInterface),
      this.savePreference(ZOOM_LEVEL_SETTING, interfaceScale),
      this.savePreference(COMPILE_VERBOSE_SETTING, verboseOnCompile),
      this.savePreference(COMPILE_WARNINGS_SETTING, compilerWarnings),
      this.savePreference(UPLOAD_VERBOSE_SETTING, verboseOnUpload),
      this.savePreference(UPLOAD_VERIFY_SETTING, verifyAfterUpload),
      this.savePreference(SHOW_ALL_FILES_SETTING, sketchbookShowAllFiles),
      this.savePreference(EDITOR_HOVER_SETTING, editorHover),
      this.savePreference(
        SUGGEST_ON_TRIGGER_CHARACTERS_SETTING,
        suggestOnTriggerCharacters
      ),
      this.savePreference(
        AUTO_CLOSING_BRACKETS_SETTING,
        autoClosing ? 'languageDefined' : 'never'
      ),
      this.savePreference(
        AUTO_CLOSING_QUOTES_SETTING,
        autoClosing ? 'languageDefined' : 'never'
      ),
      this.savePreference(CHECK_FOR_UPDATES_SETTING, checkForUpdates),
      this.savePreference(SHOW_CLOUD_SKETCHES_SETTING, showCloudSketches),
      this.savePreference(LIBRARIES_PATH_SETTING, librariesPath),
      this.configService.setConfiguration(updatedConfig),
    ]);
    this.onDidChangeEmitter.fire(this._settings);
    this.loaded = deepClone(this._settings);
    await this.warnAboutOldLibraries(oldLibraries, newLibraries, renamedTo);

    // after saving all the settings, if we need to change the language we need to perform a reload
    // Only reload if the language differs from the current locale. `nls.locale === undefined` signals english as well
    if (
      currentLanguage !== (await this.localizationProvider.getCurrentLanguage())
    ) {
      await this.localizationProvider.setCurrentLanguage(currentLanguage);
      if (currentLanguage === 'en') {
        window.localStorage.removeItem(nls.localeId);
      } else {
        window.localStorage.setItem(nls.localeId, currentLanguage);
      }
      this.commandService.executeCommand(ElectronCommands.RELOAD.id);
    }

    return true;
  }
}
