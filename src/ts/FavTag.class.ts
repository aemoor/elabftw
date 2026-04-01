/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */
import { Model } from './interfaces';
import SidePanel from './SidePanel.class';
import TodoList from './Todolist.class';
import TocPanel from './TocPanel.class';
import { ApiC } from './api';

export default class FavTag extends SidePanel {

  constructor() {
    super(Model.FavTag);
    this.panelId = 'favtagsPanel';
  }

  // ADD A TAG AS FAVORITE
  create(content: string): Promise<Response> {
    return ApiC.post(Model.FavTag, {tag: content });
  }

  toggle(): void {
    // force other panels to close
    (new TodoList).hide();
    (new TocPanel).hide();
    super.toggle();
  }
}
