import { nls } from '@theia/core/lib/common';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { injectable } from '@theia/core/shared/inversify';
import { OpenFileAsTab } from './open-file-as-tab';
import { ArduinoMenus } from '../menu/arduino-menus';
import {
  SketchContribution,
  Command,
  CommandRegistry,
  MenuModelRegistry,
  KeybindingRegistry,
} from './contribution';

@injectable()
export class NewSketch extends SketchContribution {
  override registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(NewSketch.Commands.NEW_SKETCH, {
      execute: () => this.newSketch(),
    });
  }

  override registerMenus(registry: MenuModelRegistry): void {
    registry.registerMenuAction(ArduinoMenus.FILE__SKETCH_GROUP, {
      commandId: NewSketch.Commands.NEW_SKETCH.id,
      label: nls.localize('arduino/sketch/new', 'New Sketch'),
      order: '0',
    });
  }

  override registerKeybindings(registry: KeybindingRegistry): void {
    registry.registerKeybinding({
      command: NewSketch.Commands.NEW_SKETCH.id,
      keybinding: 'CtrlCmd+N',
    });
  }

  async newSketch(): Promise<void> {
    try {
      const sketch = await this.sketchesService.createNewSketch();
      // The new sketch opens as tabs of this window instead of a new window.
      await this.commandService.executeCommand(
        OpenFileAsTab.Commands.OPEN_SKETCH_AS_TABS.id,
        FileUri.fsPath(sketch.uri)
      );
    } catch (e) {
      await this.messageService.error(e.toString());
    }
  }
}

export namespace NewSketch {
  export namespace Commands {
    export const NEW_SKETCH: Command = {
      id: 'arduino-new-sketch',
    };
  }
}
