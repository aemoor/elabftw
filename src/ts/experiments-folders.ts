/**
 * @author Andreas Moor
 * @copyright 2026 Andreas Moor
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

import { Api } from './Apiv2.class';

document.addEventListener('DOMContentLoaded', () => {
  // Only run on experiments page
  if (!document.getElementById('experimentsFoldersSidebar')) {
    return;
  }

  const ApiC = new Api();

  // Show folder action buttons on hover
  document.querySelectorAll('#experimentsFoldersContent a').forEach(link => {
    const parent = link.parentElement;
    const actions = parent?.querySelector('.folder-actions') as HTMLElement;
    if (actions) {
      parent.addEventListener('mouseenter', () => actions.style.display = 'inline');
      parent.addEventListener('mouseleave', () => actions.style.display = 'none');
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
    ApiC.post('api/v2/experiments_folders', {
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
        ApiC.patch(`api/v2/experiments_folders/${folderId}`, {
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
        ApiC.delete(`api/v2/experiments_folders/${folderId}`).then(() => {
          window.location.reload();
        });
      }
    });
  });
});
