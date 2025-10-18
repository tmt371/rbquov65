// File: 04-core-code/ui/views/quick-quote-view.js

import { EVENTS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';

/**
 * @fileoverview A view class responsible for all logic related to the main "Quick Quote" screen.
 */
export class QuickQuoteView {
    constructor({ 
        stateService, 
        calculationService, 
        focusService, 
        fileService, 
        eventAggregator, 
        productFactory, 
        configManager 
    }) {
        this.stateService = stateService;
        this.calculationService = calculationService;
        this.focusService = focusService;
        this.fileService = fileService;
        this.eventAggregator = eventAggregator;
        this.productFactory = productFactory;
        this.configManager = configManager;
        console.log("QuickQuoteView Initialized.");
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }
    
    _getCurrentProductType() {
        const { quoteData } = this._getState();
        return quoteData.currentProduct;
    }

    _commitInputValue() {
        const { ui } = this._getState();
        const { activeCell, inputValue } = ui;
        if (!activeCell) return;

        const valueAsNumber = Number(inputValue);
        if (isNaN(valueAsNumber)) {
            console.error('Invalid number for commit:', inputValue);
            return;
        }

        this.stateService.dispatch(quoteActions.updateItemValue(activeCell.rowIndex, activeCell.column, valueAsNumber));
        this.stateService.dispatch(uiActions.setSumOutdated(true));
    }

    handleNumericKeyPress({ key }) {
        const { ui } = this._getState();
        const { activeCell } = ui;

        if (!activeCell) return;

        switch (key) {
            case 'W':
                this.focusService.focusFirstEmptyCell('width');
                break;
            case 'H':
                this.focusService.focusFirstEmptyCell('height');
                break;
            case 'DEL':
                this.stateService.dispatch(uiActions.deleteLastInputChar());
                break;
            case 'ENT':
                this._commitInputValue();
                this.focusService.focusAfterCommit();
                break;
            default: // Numeric keys
                if (activeCell.column === 'width' || activeCell.column === 'height') {
                    this.stateService.dispatch(uiActions.appendInputValue(key));
                }
                break;
        }
    }

    handleInsertRow() {
        const { ui } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        const items = this._getItems();

        if (multiSelectSelectedIndexes.length !== 1) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select exactly one row to insert a new row below it.' });
            return;
        }

        const selectedIndex = multiSelectSelectedIndexes[0];
        const nextItem = items[selectedIndex + 1];

        if (nextItem && (!nextItem.width && !nextItem.height && !nextItem.fabricType)) {
             this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'You can only insert a row above a row that contains data.' });
            return;
        }
        
        this.stateService.dispatch(quoteActions.insertRow(selectedIndex));
        this.stateService.dispatch(uiActions.setActiveCell(selectedIndex + 1, 'width'));
        this.stateService.dispatch(uiActions.clearMultiSelectSelection());
    }

    handleDeleteRow() {
        const { ui } = this._getState();
        const { multiSelectSelectedIndexes } = ui;

        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select one or more rows to delete.' });
            return;
        }
        
        this.stateService.dispatch(quoteActions.deleteMultipleRows(multiSelectSelectedIndexes));
        this.focusService.focusAfterDelete();
    }

    // [REVISED] Show confirmation dialog for clear/delete actions.
    handleClearRow() {
        const { ui } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select one or more rows first.' });
            return;
        }

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `You have selected ${multiSelectSelectedIndexes.length} row(s). What would you like to do?`,
            layout: [[
                { type: 'button', text: 'Delete Rows', className: 'secondary', callback: () => {
                    this.stateService.dispatch(quoteActions.deleteMultipleRows(multiSelectSelectedIndexes));
                    this.focusService.focusAfterDelete();
                }},
                { type: 'button', text: 'Clear Rows', callback: () => {
                    this.stateService.dispatch(quoteActions.clearMultipleRows(multiSelectSelectedIndexes));
                    this.stateService.dispatch(uiActions.clearMultiSelectSelection());
                }},
                { type: 'button', text: 'Cancel', className: 'secondary', callback: () => {} }
            ]]
        });
    }

    handleSaveToFile() {
        const { quoteData } = this._getState();
        const result = this.fileService.saveToJson(quoteData);
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message, type: result.success ? 'info' : 'error' });
    }

    handleExportCSV() {
        const { quoteData } = this._getState();
        const result = this.fileService.exportToCsv(quoteData);
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message, type: result.success ? 'info' : 'error' });
    }

    handleReset() {
        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'Are you sure you want to clear all data and start a new quote?',
            layout: [[
                { type: 'button', text: 'Confirm Reset', callback: () => {
                    this.stateService.dispatch(quoteActions.resetQuoteData());
                    this.stateService.dispatch(uiActions.resetUi());
                }},
                { type: 'button', text: 'Cancel', className: 'secondary', callback: () => {} }
            ]]
        });
    }

    handleMoveActiveCell({ direction }) {
        this.focusService.moveActiveCell(direction);
    }
    
    handleCalculateAndSum() {
        const { quoteData } = this._getState();
        const productStrategy = this.productFactory.getProductStrategy(this._getCurrentProductType());
        const { updatedQuoteData, firstError } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
        
        if (firstError) {
            this.stateService.dispatch(uiActions.setSumOutdated(true));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: firstError.message, type: 'error' });
            this.stateService.dispatch(uiActions.setActiveCell(firstError.rowIndex, firstError.column));
        } else {
            this.stateService.dispatch(uiActions.setSumOutdated(false));
        }
    }

    // [REVISED] Removed clearMultiSelectSelection to allow highlighting while editing cells.
    handleTableCellClick({ rowIndex, column }) {
        this.stateService.dispatch(uiActions.setActiveCell(rowIndex, column));
        
        const item = this._getItems()[rowIndex];
        if (item && (column === 'width' || column === 'height')) {
            this.stateService.dispatch(uiActions.setInputValue(item[column]));
        } else {
            this.stateService.dispatch(uiActions.setInputValue(''));
        }
    }
    
    // [REVISED] Correctly handle single vs multi-select mode on sequence cell click.
    handleSequenceCellClick({ rowIndex }) {
        const { ui } = this._getState();
        if (!ui.isMultiSelectMode) {
            // In single-select mode, clicking a new row clears old selections.
            this.stateService.dispatch(uiActions.clearMultiSelectSelection());
        }
        this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
    }
    
    // [REVISED] Handle batch cycling for all items, not just the active cell.
    handleCycleType() {
        const { ui } = this._getState();
        if (ui.isMultiSelectMode && ui.multiSelectSelectedIndexes.length > 0) {
            // If in multi-select mode, this button should do nothing to avoid confusion.
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Batch cycle is disabled in multi-select mode. Use the long-press menu instead.' });
            return;
        }
        // Dispatch the batch update action. The reducer will handle the cycling logic.
        this.stateService.dispatch(quoteActions.batchUpdateFabricType());
        this.stateService.dispatch(uiActions.setSumOutdated(true));
    }

    handleToggleMultiSelectMode() {
        this.stateService.dispatch(uiActions.toggleMultiSelectMode());
    }

    handleSaveThenLoad() {
        this.handleSaveToFile();
        this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
    }
    
    handleTypeCellLongPress({ rowIndex }) {
        this.stateService.dispatch(uiActions.clearMultiSelectSelection());
        this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
        this.handleMultiTypeSet();
    }

    // [REVISED] Ensure long-press on TYPE button triggers the multi-set dialog.
    handleTypeButtonLongPress() {
        this.handleMultiTypeSet();
    }

    // [REVISED] Rebuild the dialog layout to be a two-column table with descriptions.
    handleMultiTypeSet() {
        const { ui } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        
        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: "Please select one or more rows first by clicking on their sequence numbers ('#')." });
            return;
        }

        const fabricTypes = this.configManager.getFabricTypeSequence();
        const layout = [];

        fabricTypes.forEach(type => {
            const matrix = this.configManager.getPriceMatrix(type);
            const description = matrix ? matrix.name : 'Unknown';

            layout.push([
                {
                    type: 'button',
                    text: type,
                    callback: () => {
                        this.stateService.dispatch(quoteActions.batchUpdateFabricTypeForSelection(multiSelectSelectedIndexes, type));
                        this.stateService.dispatch(uiActions.setSumOutdated(true));
                        this.stateService.dispatch(uiActions.clearMultiSelectSelection());
                    }
                },
                {
                    type: 'text',
                    text: description,
                    className: 'text-cell'
                }
            ]);
        });
        
        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Set fabric type for selected rows (${multiSelectSelectedIndexes.length}):`,
            layout: layout,
            position: 'bottomThird'
        });
    }
}