/**
 * @author eLabFTW custom
 * @license AGPL-3.0
 * @package elabftw
 *
 * Inline spreadsheet — embeds a small jspreadsheet grid inside the TinyMCE body.
 * Data (including formulas) is stored as base64-encoded JSON in a data-spreadsheet
 * attribute on the <table>. The table cells show computed values so the document
 * looks correct even without JavaScript.
 */
import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';

// Type for a single cell value (string | number | boolean | null)
type CellValue = string | number | boolean | null;
// Array-of-arrays data representation
type AOA = CellValue[][];
// jspreadsheet-ce v5 instance — types in the package are incomplete, use any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JssInstance = any;

export interface SpreadsheetData {
  /** Array-of-arrays with raw values/formulas as entered by the user */
  data: AOA;
  /** Number of columns (minimum enforced) */
  cols: number;
  /** Number of rows (minimum enforced) */
  rows: number;
}

const DEFAULT_COLS = 6;
const DEFAULT_ROWS = 5;

/**
 * Encode spreadsheet data to a base64 string for storage in an HTML attribute.
 */
export function encodeSpreadsheetData(sd: SpreadsheetData): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(sd))));
}

/**
 * Decode spreadsheet data from a base64 string.
 */
export function decodeSpreadsheetData(encoded: string): SpreadsheetData {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return { data: [[]], cols: DEFAULT_COLS, rows: DEFAULT_ROWS };
  }
}

/**
 * Create an empty SpreadsheetData object.
 */
export function emptySpreadsheetData(): SpreadsheetData {
  const data: AOA = [];
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    data.push(new Array(DEFAULT_COLS).fill(''));
  }
  return { data, cols: DEFAULT_COLS, rows: DEFAULT_ROWS };
}

/**
 * Helper: get the first worksheet from a jspreadsheet v5 instance.
 */
function getWorksheet(instance: JssInstance): JssInstance {
  return instance?.[0] ?? instance;
}

/**
 * Helper: read computed cell values from the rendered jspreadsheet DOM.
 * v5 uses class "jss_worksheet" on the table. Cell textContent always shows
 * evaluated formula results.
 */
function getComputedDataFromDOM(container: HTMLElement): AOA {
  const result: AOA = [];
  const tbody = container.querySelector('.jss_worksheet tbody, table.jss tbody, table.jexcel tbody');
  if (!tbody) return result;
  const trs = tbody.querySelectorAll('tr');
  trs.forEach(tr => {
    const row: CellValue[] = [];
    const tds = tr.querySelectorAll('td');
    tds.forEach((td, idx) => {
      if (idx === 0) return; // skip row-number column
      row.push(td.textContent?.trim() ?? '');
    });
    if (row.length > 0) result.push(row);
  });
  return result;
}

/**
 * Create the overlay + dialog elements (plain DIV, no Bootstrap modal).
 * This avoids Bootstrap's enforceFocus which breaks jspreadsheet formula
 * range selection.
 */
function createOverlay(): {
  overlay: HTMLDivElement;
  dialog: HTMLDivElement;
  sheetContainer: HTMLDivElement;
  insertBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  addRowBtn: HTMLButtonElement;
  addColBtn: HTMLButtonElement;
} {
  // Backdrop
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10050', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  });

  // Dialog box
  const dialog = document.createElement('div');
  Object.assign(dialog.style, {
    backgroundColor: '#fff', borderRadius: '8px', padding: '16px',
    width: '80vw', maxWidth: '900px', maxHeight: '80vh', display: 'flex',
    flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  });

  // Title
  const title = document.createElement('h5');
  title.textContent = 'Edit Spreadsheet';
  title.style.marginBottom = '8px';
  dialog.appendChild(title);

  // Formula helper bar
  const formulaBar = document.createElement('div');
  Object.assign(formulaBar.style, {
    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
    flexWrap: 'wrap', fontSize: '0.85em',
  });
  const formulaLabel = document.createElement('span');
  formulaLabel.textContent = 'Formulas:';
  formulaLabel.style.fontWeight = 'bold';
  formulaLabel.style.color = '#555';
  formulaBar.appendChild(formulaLabel);

  const formulas: Array<{ name: string; example: string; desc: string }> = [
    { name: 'SUM', example: '=SUM(A1:A10)', desc: 'Sum of values' },
    { name: 'AVERAGE', example: '=AVERAGE(A1:A10)', desc: 'Mean of values' },
    { name: 'COUNT', example: '=COUNT(A1:A10)', desc: 'Count of values' },
    { name: 'MIN', example: '=MIN(A1:A10)', desc: 'Minimum value' },
    { name: 'MAX', example: '=MAX(A1:A10)', desc: 'Maximum value' },
    { name: 'IF', example: '=IF(A1>0,"yes","no")', desc: 'Conditional' },
    { name: 'ROUND', example: '=ROUND(A1,2)', desc: 'Round to N decimals' },
    { name: 'ABS', example: '=ABS(A1)', desc: 'Absolute value' },
    { name: 'CONCATENATE', example: '=CONCATENATE(A1,B1)', desc: 'Join text' },
  ];

  formulas.forEach(f => {
    const chip = document.createElement('span');
    chip.textContent = f.name;
    chip.title = `${f.desc}\nExample: ${f.example}`;
    Object.assign(chip.style, {
      display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
      backgroundColor: '#e9ecef', color: '#333', cursor: 'pointer',
      border: '1px solid #ccc', fontSize: '0.85em', userSelect: 'none',
    });
    chip.addEventListener('mouseenter', () => { chip.style.backgroundColor = '#d0d4d8'; });
    chip.addEventListener('mouseleave', () => { chip.style.backgroundColor = '#e9ecef'; });
    chip.addEventListener('click', () => {
      // Copy example to clipboard for easy pasting
      navigator.clipboard?.writeText(f.example).then(() => {
        chip.style.backgroundColor = '#c3e6cb';
        setTimeout(() => { chip.style.backgroundColor = '#e9ecef'; }, 600);
      });
    });
    formulaBar.appendChild(chip);
  });

  const helperNote = document.createElement('span');
  helperNote.textContent = '(click to copy example, drag corner to fill)';
  helperNote.style.color = '#999';
  helperNote.style.fontSize = '0.8em';
  helperNote.style.marginLeft = '4px';
  formulaBar.appendChild(helperNote);

  dialog.appendChild(formulaBar);

  // Spreadsheet container
  const sheetContainer = document.createElement('div');
  Object.assign(sheetContainer.style, {
    flex: '1', minHeight: '300px', overflow: 'auto', marginBottom: '12px',
  });
  dialog.appendChild(sheetContainer);

  // Button row
  const btnRow = document.createElement('div');
  Object.assign(btnRow.style, {
    display: 'flex', justifyContent: 'space-between', gap: '8px',
  });

  const leftBtns = document.createElement('div');
  leftBtns.style.display = 'flex';
  leftBtns.style.gap = '6px';

  const addRowBtn = document.createElement('button');
  addRowBtn.textContent = '+ Row';
  addRowBtn.className = 'btn btn-sm btn-outline-secondary';
  leftBtns.appendChild(addRowBtn);

  const addColBtn = document.createElement('button');
  addColBtn.textContent = '+ Column';
  addColBtn.className = 'btn btn-sm btn-outline-secondary';
  leftBtns.appendChild(addColBtn);

  const rightBtns = document.createElement('div');
  rightBtns.style.display = 'flex';
  rightBtns.style.gap = '6px';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn btn-sm btn-secondary';
  rightBtns.appendChild(cancelBtn);

  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Insert / Update';
  insertBtn.className = 'btn btn-sm btn-primary';
  rightBtns.appendChild(insertBtn);

  btnRow.appendChild(leftBtns);
  btnRow.appendChild(rightBtns);
  dialog.appendChild(btnRow);

  overlay.appendChild(dialog);

  // Stop clicks on dialog from closing via overlay
  dialog.addEventListener('click', e => e.stopPropagation());

  return { overlay, dialog, sheetContainer, insertBtn, cancelBtn, addRowBtn, addColBtn };
}

/**
 * Open the spreadsheet editor as a plain overlay (not Bootstrap modal),
 * populate with data, and return a promise that resolves with updated data
 * when the user clicks "Insert/Update", or rejects on cancel.
 */
export function openSpreadsheetModal(initial: SpreadsheetData): Promise<{ raw: SpreadsheetData; computed: AOA }> {
  return new Promise((resolve, reject) => {
    const { overlay, sheetContainer, insertBtn, cancelBtn, addRowBtn, addColBtn }
      = createOverlay();

    document.body.appendChild(overlay);

    // Initialize jspreadsheet v5
    const instance: JssInstance = (jspreadsheet as Function)(sheetContainer as HTMLDivElement, {
      worksheets: [{
        data: initial.data.length > 0 ? initial.data : [[]],
        minDimensions: [Math.max(DEFAULT_COLS, initial.cols), Math.max(DEFAULT_ROWS, initial.rows)],
      }],
      tableOverflow: true,
      tableWidth: '100%',
      tableHeight: '400px',
      allowInsertRow: true,
      allowInsertColumn: true,
      allowDeleteRow: true,
      allowDeleteColumn: true,
      columnSorting: false,
      // Enable drag-to-fill corner handle for copying formulas/values to adjacent cells
      selectionCopy: true,
    });

    const ws: JssInstance = getWorksheet(instance);

    const cleanup = () => {
      overlay.remove();
    };

    addRowBtn.addEventListener('click', () => ws?.insertRow?.());
    addColBtn.addEventListener('click', () => ws?.insertColumn?.());

    insertBtn.addEventListener('click', () => {
      // Read computed values from DOM BEFORE destroying the instance
      const computed = getComputedDataFromDOM(sheetContainer);
      // Get raw data (with formulas)
      const rawData: AOA = ws?.getData?.() ?? [[]];
      const trimmed = trimData(rawData);
      const result: SpreadsheetData = {
        data: trimmed,
        cols: trimmed[0]?.length || DEFAULT_COLS,
        rows: trimmed.length || DEFAULT_ROWS,
      };
      cleanup();
      resolve({ raw: result, computed });
    });

    const doCancel = () => {
      cleanup();
      reject(new Error('cancelled'));
    };

    cancelBtn.addEventListener('click', doCancel);
    // Click on backdrop closes
    overlay.addEventListener('click', doCancel);
    // Escape key closes
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        doCancel();
      }
    };
    document.addEventListener('keydown', onKey);
  });
}

/**
 * Convert SpreadsheetData into an HTML <table> string with computed values.
 * Includes column headers (A, B, C...) and row numbers for readability.
 */
export function spreadsheetToHTML(raw: SpreadsheetData, computed: AOA): string {
  const encoded = encodeSpreadsheetData(raw);
  const cols = raw.cols || computed[0]?.length || DEFAULT_COLS;

  let html = `<table class="elabftw-spreadsheet" data-spreadsheet="${encoded}" border="1" style="border-collapse:collapse;min-width:25%">`;

  // Column headers row (A, B, C, ...)
  html += '<tr>';
  html += '<th style="padding:2px 6px;background:#f0f0f0;color:#666;font-size:0.85em;text-align:center;min-width:30px"></th>';
  for (let c = 0; c < cols; c++) {
    html += `<th style="padding:2px 6px;background:#f0f0f0;color:#666;font-size:0.85em;text-align:center">${colLabel(c)}</th>`;
  }
  html += '</tr>';

  // Data rows
  const displayData = computed.length > 0 ? computed : raw.data;
  for (let r = 0; r < displayData.length; r++) {
    html += '<tr>';
    html += `<td style="padding:2px 6px;background:#f0f0f0;color:#666;font-size:0.85em;text-align:center">${r + 1}</td>`;
    const row = displayData[r] || [];
    for (let c = 0; c < cols; c++) {
      const val = c < row.length ? (row[c] ?? '') : '';
      html += `<td style="padding:4px 8px">${escapeHTML(String(val))}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

/**
 * Extract SpreadsheetData from an existing HTML table element.
 */
export function extractFromTable(tableEl: HTMLTableElement): SpreadsheetData {
  const encoded = tableEl.dataset.spreadsheet;
  if (encoded) {
    return decodeSpreadsheetData(encoded);
  }
  // Fallback: extract cell text content (skip header row if present)
  const data: AOA = [];
  const rows = tableEl.querySelectorAll('tr');
  rows.forEach((tr, idx) => {
    if (idx === 0 && tr.querySelector('th')) return;
    const rowData: CellValue[] = [];
    const cells = tr.querySelectorAll('td');
    cells.forEach((cell, cellIdx) => {
      if (cellIdx === 0 && /^\d+$/.test(cell.textContent?.trim() || '')) return;
      rowData.push(cell.textContent?.trim() || '');
    });
    if (rowData.length > 0) data.push(rowData);
  });
  const cols = Math.max(...data.map(r => r.length), DEFAULT_COLS);
  return { data, cols, rows: data.length || DEFAULT_ROWS };
}

// Helpers

/** Convert column index to letter label (0=A, 1=B, ..., 25=Z, 26=AA) */
function colLabel(index: number): string {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function trimData(data: AOA): AOA {
  let lastNonEmptyRow = -1;
  for (let r = data.length - 1; r >= 0; r--) {
    if (data[r].some(cell => cell !== '' && cell !== null && cell !== undefined)) {
      lastNonEmptyRow = r;
      break;
    }
  }
  if (lastNonEmptyRow === -1) return [[]];
  const trimmed = data.slice(0, lastNonEmptyRow + 1);

  let lastNonEmptyCol = 0;
  for (const row of trimmed) {
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
        lastNonEmptyCol = Math.max(lastNonEmptyCol, c);
        break;
      }
    }
  }
  return trimmed.map(row => row.slice(0, lastNonEmptyCol + 1));
}

function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
