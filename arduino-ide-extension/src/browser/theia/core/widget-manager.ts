import type { Widget } from '@theia/core/lib/browser';
import { WidgetManager as TheiaWidgetManager } from '@theia/core/lib/browser/widget-manager';
import { injectable } from '@theia/core/shared/inversify';
import { OutputWidget } from '@theia/output/lib/browser/output-widget';

/**
 * Only the output can not be closed. Unlike IDE2, the editors of the sketch files, the main file included, can be
 * closed like any other tab: what to compile follows the active tab anyway, and without one it is the main file.
 */
@injectable()
export class WidgetManager extends TheiaWidgetManager {
  override getOrCreateWidget<T extends Widget>(
    factoryId: string,
    options?: unknown
  ): Promise<T> {
    const unresolvedWidget = super.getOrCreateWidget<T>(factoryId, options);
    unresolvedWidget.then((widget) => {
      if (widget instanceof OutputWidget) {
        this.setWidgetUncloseable(widget); // TODO: https://arduino.slack.com/archives/C01698YT7S4/p1598011990133700
      }
    });
    return unresolvedWidget;
  }

  private setWidgetUncloseable(widget: Widget): void {
    const { title } = widget;
    if (title.closable) {
      title.closable = false;
    }
    // Show the dirty indicator on uncloseable widgets when hovering over the title. Instead of showing the `X` for close.
    const uncloseableClass = 'a-mod-uncloseable';
    if (!title.className.includes(uncloseableClass)) {
      title.className += ` ${uncloseableClass}`;
    }
  }
}
