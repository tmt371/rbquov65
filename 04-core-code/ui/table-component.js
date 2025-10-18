// File: 04-core-code/ui/table-component.js

/**
 * @fileoverview A highly reusable component for rendering table data.
 * It uses a strategy pattern to delegate the rendering of complex cell types.
 */
import { DOM_IDS } from '../config/constants.js';

export class TableComponent {
    constructor() {
        this.table = document.getElementById(DOM_IDS.RESULTS_TABLE);
        if (!this.table) {
            throw new Error(`Element with ID '${DOM_IDS.RESULTS_TABLE}' not found.`);
        }
        // Ensure tbody exists or create it.
        this.tbody = this.table.querySelector('tbody');
        if (!this.tbody) {
            this.tbody = document.createElement('tbody');
            this.table.appendChild(this.tbody);
        }

        // --- Cell Rendering Strategies ---
        this.cellRenderers = {
            default: (item, column) => item[column] ?? '',
            price: (item) => (typeof item.linePrice === 'number' ? `$${item.linePrice.toFixed(2)}` : ''),
            fabricTypeDisplay: (item) => {
                if (!item.fabricType) return '';
                const typeClass = `type-${item.fabricType.toLowerCase()}`;
                return `<span class="${typeClass}">${item.fabricType}</span>`;
            }
        };

        console.log("TableComponent (Refactored with Renderer Strategy) Initialized.");
    }

    render(state) {
        if (!state) return;
        const { ui, quoteData } = state;
        const { 
            visibleColumns, 
            activeCell, 
            inputValue, 
            multiSelectSelectedIndexes, 
            activeEditMode,
            dualChainMode,
            driveAccessoryMode,
            targetCell,
            lfSelectedRowIndexes
        } = ui;
        
        const productKey = quoteData.currentProduct;
        const items = quoteData.products[productKey].items;
        const { lfModifiedRowIndexes } = quoteData.uiMetadata;

        this.tbody.innerHTML = items.map((item, index) => {
            let rowClass = '';
            if (targetCell && targetCell.rowIndex === index && activeEditMode === 'K1') {
                rowClass += ' target-row-highlight';
            }
            if (lfSelectedRowIndexes.includes(index)) {
                rowClass += ' lf-selection-highlight';
            }
            if (lfModifiedRowIndexes.includes(index)) {
                rowClass += ' is-lf-modified';
            }

            const cells = visibleColumns.map(column => {
                let cellContent;
                let cellClass = this._getCellClass(column, item, index, state);
    
                if (column === 'sequence') {
                    const isLastRow = index === items.length - 1;
                    // The class that the event handler looks for to make the cell clickable.
                    const clickableClass = isLastRow ? '' : 'sequence-cell';
                    if (isLastRow) {
                        cellClass += ' selection-disabled'; // Add styling for disabled appearance.
                    }
                    cellContent = `<div class="${clickableClass}" data-row-index="${index}">${index + 1}</div>`;
                } else {
                    const renderer = this.cellRenderers[column] || this.cellRenderers.default;
                    cellContent = renderer(item, column, index, state);
                }

                // Render the live input value in the active cell.
                if (activeCell && activeCell.rowIndex === index && activeCell.column === column) {
                    if (column === 'width' || column === 'height') {
                        cellContent = inputValue;
                    }
                }
    
                return `<td class="${cellClass}" data-row-index="${index}" data-column="${column}">${cellContent}</td>`;
            }).join('');
    
            return `<tr class="${rowClass}">${cells}</tr>`;
        }).join('');
    }

    _getCellClass(column, item, index, state) {
        const { ui } = state;
        const { activeCell, multiSelectSelectedIndexes, driveAccessoryMode, dualChainMode, activeEditMode } = ui;

        let classes = `col-${column.toLowerCase()}`;
        
        if (activeCell && activeCell.rowIndex === index && activeCell.column === column) {
            classes += ' active-input-cell';
        }
        if (multiSelectSelectedIndexes.includes(index)) {
            classes += ' multi-selected-row';
        }
        
        if (column === 'price') classes += ' price-cell';

        if (driveAccessoryMode === 'winder' && column === 'winder' && item.winder) classes += ' winder-cell-active';
        if (driveAccessoryMode === 'motor' && column === 'motor' && item.motor) classes += ' motor-cell-active';
        if (dualChainMode === 'dual' && column === 'dual' && item.dual) classes += ' dual-cell-active';
        
        if (activeEditMode === 'K3' && ['over', 'oi', 'lr'].includes(column)) {
            classes += ' target-cell';
        }

        return classes;
    }
}