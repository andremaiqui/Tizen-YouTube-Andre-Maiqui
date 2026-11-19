import { every, VERSION } from '../../framework/index.js';

const PANEL = 'ytlr-setting-app-version';
const LABEL = 'Patch';
const VALUE = `version ${VERSION} Andre Maiqui`;
const MARK = 'data-tube-patch';
const CHECK_EVERY = 1000;

// A row is a label and a value, each the last element holding text.
const leavesOf = (root) => Array.from(root.querySelectorAll('*'))
    .filter((node) => node.children.length === 0 && node.textContent.trim() !== '');

const holding = (node, label, panel) => {
    if (!node || node === panel) return null;

    return node.contains(label) ? node : holding(node.parentElement, label, panel);
};

// Fallback for when the template hook in aboutPatch.js finds nothing to hook on a new YouTube build:
// the panel's last row is copied, so the Patch row keeps the look of the rows around it.
function stampPatchRow() {
    const panel = document.querySelector(PANEL);
    if (!panel || panel.querySelector(`[${MARK}]`)) return;

    const leaves = leavesOf(panel);
    if (leaves.length < 2) return;
    if (leaves.some((leaf) => leaf.textContent.trim() === LABEL)) return;

    const value = leaves[leaves.length - 1];
    const label = leaves[leaves.length - 2];
    const row = holding(value.parentElement, label, panel);

    // Anything but one row of exactly two texts is a layout this does not know how to copy.
    if (!row || !row.parentNode || leavesOf(row).length !== 2) return;

    const copy = /** @type {Element} */ (row.cloneNode(true));
    const copied = leavesOf(copy);
    copied[0].textContent = LABEL;
    copied[1].textContent = VALUE;
    copy.setAttribute(MARK, '');

    row.parentNode.insertBefore(copy, row.nextSibling);
}

const keepPatchRow = () => {
    stampPatchRow();
    return every('about-patch-row', CHECK_EVERY, stampPatchRow);
};

export { keepPatchRow };
