/**
 * @author Andreas Moor
 * @copyright 2026 Andreas Moor
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

import { Api } from './Apiv2.class';
import { on } from './handlers';

document.addEventListener('DOMContentLoaded', () => {
  // Only run on experiments page
  const sidebar = document.getElementById('experimentsFoldersSidebar');
  if (!sidebar) {
    return;
  }

  const ApiC = new Api();

  const COLLAPSED_KEY = 'collapsed-experiment-folders';

  // Read the server-provided favorite folder id
  const favoriteFolderIdAttr = sidebar.dataset.favoriteFolderId;
  let favoriteFolderId: string | null = favoriteFolderIdAttr && favoriteFolderIdAttr !== '' ? favoriteFolderIdAttr : null;

  /**
   * Get the set of collapsed folder IDs from localStorage.
   */
  function getCollapsedSet(): Set<string> {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  /**
   * Persist the collapsed set to localStorage.
   */
  function saveCollapsedSet(collapsed: Set<string>): void {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(collapsed)));
  }

  /**
   * Apply collapsed/expanded state to a single folder (caret + children + folder icon).
   */
  function applyFolderState(folderId: string, isCollapsed: boolean): void {
    const childrenDiv = document.querySelector(`.folder-children[data-parent-folder-id="${folderId}"]`) as HTMLElement;
    const toggle = document.querySelector(`.folder-toggle[data-folder-id="${folderId}"]`);
    if (!childrenDiv || !toggle) return;

    // Find the folder icon in the same row
    const folderNode = document.querySelector(`.folder-node[data-folder-id="${folderId}"]`);
    const folderIcon = folderNode?.querySelector('.folder-icon');

    if (isCollapsed) {
      childrenDiv.style.display = 'none';
      toggle.querySelector('i')?.classList.replace('fa-caret-down', 'fa-caret-right');
      folderIcon?.classList.replace('fa-folder-open', 'fa-folder');
    } else {
      childrenDiv.style.display = '';
      toggle.querySelector('i')?.classList.replace('fa-caret-right', 'fa-caret-down');
      folderIcon?.classList.replace('fa-folder', 'fa-folder-open');
    }
  }

  /**
   * Walk up from a folder node to find its root-level ancestor folder ID.
   * Returns the folder ID itself if it's already at root level.
   */
  function getRootAncestorId(folderId: string): string {
    let node = document.querySelector(`.folder-node[data-folder-id="${folderId}"]`) as HTMLElement;
    if (!node) return folderId;
    let rootId = folderId;
    while (node) {
      const parentChildren = node.parentElement?.closest('.folder-children') as HTMLElement;
      if (parentChildren) {
        // This node is inside a .folder-children container — its parent folder is the ancestor
        const ancestorNode = parentChildren.closest('.folder-node') as HTMLElement;
        if (ancestorNode && ancestorNode.dataset.folderId) {
          rootId = ancestorNode.dataset.folderId;
          node = ancestorNode;
        } else {
          break;
        }
      } else {
        // This node is at root level
        rootId = node.dataset.folderId || rootId;
        break;
      }
    }
    return rootId;
  }

  /**
   * Collect all ancestor folder IDs for a given folder (not including itself).
   */
  function getAncestorIds(folderId: string): string[] {
    const ancestors: string[] = [];
    let node = document.querySelector(`.folder-node[data-folder-id="${folderId}"]`) as HTMLElement;
    if (!node) return ancestors;
    while (node) {
      const parentChildren = node.parentElement?.closest('.folder-children') as HTMLElement;
      if (parentChildren) {
        const parentFolderId = parentChildren.dataset.parentFolderId;
        if (parentFolderId) {
          ancestors.push(parentFolderId);
        }
        node = parentChildren.closest('.folder-node') as HTMLElement;
      } else {
        break;
      }
    }
    return ancestors;
  }

  /**
   * Move the favorite folder's root ancestor to the top of the sidebar.
   * For root-level favorites this moves the folder itself;
   * for subfolder favorites this moves the containing root folder.
   */
  function pinFavoriteToTop(): void {
    if (!favoriteFolderId) return;
    const rootId = getRootAncestorId(favoriteFolderId);
    const rootNode = document.querySelector(`.folder-node[data-folder-id="${rootId}"]`) as HTMLElement;
    if (!rootNode) return;
    const parent = rootNode.parentElement;
    if (!parent) return;
    // Only move root-level nodes (safety check)
    if (parent.closest('.folder-children')) return;
    parent.insertBefore(rootNode, parent.firstChild);
  }

  /**
   * On first load, if there's a favorite folder set and no specific folder is
   * selected in the URL, collapse all root folders except the one containing
   * the favorite, and expand the full ancestor chain to the favorite.
   */
  function applyDefaultCollapseForFavorite(): void {
    if (!favoriteFolderId) return;

    const currentFolderId = new URLSearchParams(window.location.search).get('folder');
    // If a specific folder is selected, don't override collapse state
    if (currentFolderId && currentFolderId !== '0') return;

    const collapsed = getCollapsedSet();

    // Find the root ancestor and all ancestors of the favorite
    const rootAncestorId = getRootAncestorId(favoriteFolderId);
    const ancestorIds = new Set(getAncestorIds(favoriteFolderId));

    // Collapse all root-level folders except the one containing the favorite
    document.querySelectorAll('#experimentsFoldersContent .folder-node').forEach((node: HTMLElement) => {
      const folderId = node.dataset.folderId;
      if (!folderId) return;
      // Only operate on root-level folders
      if (node.closest('.folder-children')) return;

      if (folderId !== rootAncestorId) {
        // Collapse root folders that don't contain the favorite
        const childrenDiv = document.querySelector(`.folder-children[data-parent-folder-id="${folderId}"]`);
        if (childrenDiv) {
          collapsed.add(folderId);
        }
      } else {
        // Expand the root ancestor of the favorite
        collapsed.delete(folderId);
      }
    });

    // Expand all ancestors along the path to the favorite subfolder
    for (const ancestorId of ancestorIds) {
      collapsed.delete(ancestorId);
    }

    // Collapse subfolders *below* the favorite folder
    const favChildrenDiv = document.querySelector(`.folder-children[data-parent-folder-id="${favoriteFolderId}"]`);
    if (favChildrenDiv) {
      favChildrenDiv.querySelectorAll('.folder-node').forEach((node: HTMLElement) => {
        const childId = node.dataset.folderId;
        if (!childId) return;
        const hasChildren = document.querySelector(`.folder-children[data-parent-folder-id="${childId}"]`);
        if (hasChildren) {
          collapsed.add(childId);
        }
      });
    }

    saveCollapsedSet(collapsed);
  }

  // Pin favorite folder to top before applying collapse state
  pinFavoriteToTop();

  // Apply default collapse for favorite (collapse non-favorites)
  applyDefaultCollapseForFavorite();

  // Restore collapsed state on load, but ensure the path to the active folder is expanded
  const collapsed = getCollapsedSet();
  const currentFolderId = new URLSearchParams(window.location.search).get('folder');

  // If a folder is selected, ensure all its ancestors are expanded
  if (currentFolderId && currentFolderId !== '0') {
    let node = document.querySelector(`.folder-node[data-folder-id="${currentFolderId}"]`);
    while (node) {
      const parentChildren = node.closest('.folder-children') as HTMLElement;
      if (parentChildren) {
        const parentFolderId = parentChildren.dataset.parentFolderId;
        if (parentFolderId) {
          collapsed.delete(parentFolderId);
        }
        node = parentChildren.closest('.folder-node');
      } else {
        break;
      }
    }
    saveCollapsedSet(collapsed);
  }

  // Apply stored state to all folders (collapsed get closed icon, expanded get open icon)
  document.querySelectorAll('.folder-toggle[data-folder-id]').forEach((toggle: HTMLElement) => {
    const folderId = toggle.dataset.folderId;
    if (!folderId) return;
    applyFolderState(folderId, collapsed.has(folderId));
  });

  // Toggle folder on click — registered via the global on() dispatcher
  // because #container's click listener routes all data-action clicks
  on('toggle-folder-children', (el: HTMLElement) => {
    const folderId = el.dataset.folderId;
    if (!folderId) return;
    const current = getCollapsedSet();
    if (current.has(folderId)) {
      current.delete(folderId);
      applyFolderState(folderId, false);
    } else {
      current.add(folderId);
      applyFolderState(folderId, true);
    }
    saveCollapsedSet(current);
  });

  // Toggle favorite folder on star click
  on('toggle-favorite-folder', (el: HTMLElement) => {
    const folderId = el.dataset.id;
    if (!folderId) return;

    ApiC.patch('experiments_folders', {
      action: 'toggle_favorite',
      folder_id: parseInt(folderId, 10),
    }).then(() => {
      // Reload to reflect the new favorite state (reorder + collapse)
      window.location.reload();
    });
  });

  // Show folder action buttons on hover
  document.querySelectorAll('#experimentsFoldersContent .folder-node > .d-flex').forEach(row => {
    const actions = row.querySelector('.folder-actions') as HTMLElement;
    if (actions) {
      row.addEventListener('mouseenter', () => actions.style.display = 'inline');
      row.addEventListener('mouseleave', () => actions.style.display = 'none');
    }
  });

  // Create folder
  document.querySelector('[data-action="create-experiment-folder"]')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newFolderName') as HTMLInputElement;
    const parentSelect = document.getElementById('newFolderParent') as HTMLSelectElement;
    const name = nameInput.value.trim();
    if (!name) {
      return;
    }
    const parentId = parentSelect.value ? parseInt(parentSelect.value, 10) : null;
    ApiC.post('experiments_folders', {
      name: name,
      parent_id: parentId,
    }).then(() => {
      nameInput.value = '';
      window.location.reload();
    });
  });

  // Allow Enter key to create folder
  document.getElementById('newFolderName')?.addEventListener('keypress', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      (document.querySelector('[data-action="create-experiment-folder"]') as HTMLElement)?.click();
    }
  });

  // Rename folder
  document.querySelectorAll('[data-action="rename-folder"]').forEach(el => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      const folderId = target.dataset.id;
      const currentName = target.dataset.name;
      const newName = prompt('Enter new folder name:', currentName);
      if (newName && newName.trim() !== '' && newName !== currentName) {
        ApiC.patch(`experiments_folders/${folderId}`, {
          name: newName.trim(),
        }).then(() => {
          window.location.reload();
        });
      }
    });
  });

  // Delete folder
  document.querySelectorAll('[data-action="delete-folder"]').forEach(el => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      const folderId = target.dataset.id;
      if (confirm('Delete this folder? Experiments inside it will be moved to Unfiled.')) {
        ApiC.delete(`experiments_folders/${folderId}`).then(() => {
          window.location.reload();
        });
      }
    });
  });
});
