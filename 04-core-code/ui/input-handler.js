// File: 04-core-code/ui/input-handler.js

import { EVENTS, DOM_IDS } from '../config/constants.js';

/**
 * @fileoverview Centralized DOM event listener.
 * Captures raw DOM events and publishes them as meaningful application events.
 */
export class InputHandler {
    constructor(eventAggregator) {
        this.eventAggregator = eventAggregator;
        this.longPressTimer = null;
        this.longPressDuration = 700; // ms
    }

    initialize() {
        // --- Keyboard Events ---
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        
        // --- Click Events using Delegation ---
        document.getElementById(DOM_IDS.NUMERIC_KEYBOARD)?.addEventListener('click', this._handleKeyboardClick.bind(this));
        document.getElementById(DOM_IDS.RESULTS_TABLE)?.addEventListener('click', this._handleTableClick.bind(this));
        
        // --- Long Press (Mousedown/Mouseup) Events ---
        const typeCell = document.getElementById(DOM_IDS.RESULTS_TABLE);
        const typeButton = document.getElementById('key-type');

        if (typeCell) {
            typeCell.addEventListener('mousedown', (e) => this._handleMouseDown(e, 'typeCell'));
            typeCell.addEventListener('mouseup', this._handleMouseUp.bind(this));
            typeCell.addEventListener('mouseleave', this._handleMouseUp.bind(this));
            typeCell.addEventListener('touchstart', (e) => this._handleMouseDown(e, 'typeCell'), { passive: true });
            typeCell.addEventListener('touchend', this._handleMouseUp.bind(this));
        }

        if (typeButton) {
            typeButton.addEventListener('mousedown', (e) => this._handleMouseDown(e, 'typeButton'));
            typeButton.addEventListener('mouseup', this._handleMouseUp.bind(this));
            typeButton.addEventListener('mouseleave', this._handleMouseUp.bind(this));
            typeButton.addEventListener('touchstart', (e) => this._handleMouseDown(e, 'typeButton'), { passive: true });
            typeButton.addEventListener('touchend', this._handleMouseUp.bind(this));
        }

        document.getElementById(DOM_IDS.PANEL_TOGGLE)?.addEventListener('click', this._handlePanelToggle.bind(this));
    }

    _handleKeyDown(event) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };

        if (keyMap[event.key]) {
            event.preventDefault();
            this.eventAggregator.publish(EVENTS.USER_MOVED_ACTIVE_CELL, { direction: keyMap[event.key] });
        }
    }

    _handleKeyboardClick(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const key = button.id.replace('key-', '').toUpperCase();
        
        switch (key) {
            case 'W':
            case 'H':
            case 'ENT':
            case 'DEL':
                this.eventAggregator.publish(EVENTS.NUMERIC_KEY_PRESSED, { key });
                break;
            case 'PRICE':
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_CALCULATE_AND_SUM);
                break;
            case 'TYPE':
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_CYCLE_TYPE);
                break;
            case 'M-SET':
                this.eventAggregator.publish(EVENTS.USER_TOGGLED_MULTI_SELECT_MODE);
                break;
            case 'INS-GRID':
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_INSERT_ROW);
                break;
            case 'CLEAR':
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_CLEAR_ROW);
                break;
            default:
                if (!isNaN(key)) {
                    this.eventAggregator.publish(EVENTS.NUMERIC_KEY_PRESSED, { key });
                }
                break;
        }
    }
    
    _handleTableClick(event) {
        const target = event.target;
        
        // Check if a sequence cell was clicked
        if (target.classList.contains('sequence-cell')) {
            const rowIndex = parseInt(target.dataset.rowIndex, 10);
            this.eventAggregator.publish(EVENTS.SEQUENCE_CELL_CLICKED, { rowIndex });
            // [FIX] Explicitly stop further execution to prevent double events.
            return; 
        }

        // Handle clicks on any other cell in the table body
        const cell = target.closest('td');
        if (cell && cell.dataset.rowIndex) {
            const rowIndex = parseInt(cell.dataset.rowIndex, 10);
            const column = cell.dataset.column;
            this.eventAggregator.publish(EVENTS.TABLE_CELL_CLICKED, { rowIndex, column });
        }
    }

    _handlePanelToggle(event) {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_NUMERIC_KEYBOARD);
    }
    
    _handleMouseDown(event, context) {
        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null; // Prevent mouseup from firing short click

            if (context === 'typeCell') {
                const cell = event.target.closest('td');
                if (cell && cell.dataset.column === 'TYPE') {
                    const rowIndex = parseInt(cell.dataset.rowIndex, 10);
                    this.eventAggregator.publish(EVENTS.TYPE_CELL_LONG_PRESSED, { rowIndex });
                }
            } else if (context === 'typeButton') {
                this.eventAggregator.publish(EVENTS.TYPE_BUTTON_LONG_PRESSED);
            }
        }, this.longPressDuration);
    }

    _handleMouseUp() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
}