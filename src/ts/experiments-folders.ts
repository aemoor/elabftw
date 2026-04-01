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
  if (!document.getElementById('experimentsFoldersSidebar')) {
    return;
  }

  const ApiC = new Api();

  const COLLAPSED_KEY = 'collapsed-experiment-folders';

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
   * Apply collapsed/expanded state to a single folder.
   */
  function applyFolderState(folderId: string, isCollapsed: boolean): void {
    const childrenDiv = document.querySelector(`.folder-children[data-parent-folder-id="${folderId}"]`) as HTMLElement;
    const toggle = document.querySelector(`.folder-toggle[data-folder-id="${folderId}"]`);
    if (!childrenDiv || !toggle) return;

    if (isCollapsed) {
      childrenDiv.style.display = 'none';
      toggle.querySelector('i')?.classList.replace('fa-caret-down', 'fa-caret-right');
    } else {
      childrenDiv.style.display = '';
      toggle.querySelector('i')?.classList.replace('fa-caret-right', 'fa-caret-down');
    }
  }

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

  // Apply stored state to all folders
  document.querySelectorAll('.folder-toggle[data-folder-id]').forEach((toggle: HTMLElement) => {
    const folderId = toggle.dataset.folderId;
    if (folderId && collapsed.has(folderId)) {
      applyFolderState(folderId, true);
    }
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
