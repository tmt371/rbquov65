// File: 04-core-code/ui/right-panel-component.js

import { DOM_IDS, EVENTS } from '../config/constants.js';

/**
 * @fileoverview A container/manager component for the Right Panel.
 * Its sole responsibility is to manage the lifecycle of its sub-views (F1, F2, F3, F4)
 * and delegate rendering tasks to the currently active sub-view.
 */
export class RightPanelComponent {
    constructor({ panelElement, eventAggregator, f1View, f2View, f3View, f4View }) {
        if (!panelElement || !eventAggregator) {
            throw new Error("Panel element and event aggregator are required for RightPanelComponent.");
        }
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.state = null;

        // Store instances of sub-views
        this.views = {
            'f1-tab': f1View,
            'f2-tab': f2View,
            'f3-tab': f3View,
            'f4-tab': f4View,
        };
        this.activeView = this.views['f1-tab']; // Default active view

        this.tabContainer = this.panelElement.querySelector('.tab-container');
        this.tabButtons = this.panelElement.querySelectorAll('.tab-button');
        this.tabContents = this.panelElement.querySelectorAll('.tab-content');

        this.initialize();
        console.log("RightPanelComponent (Refactored as a Manager) Initialized.");
    }

    initialize() {
        if (this.tabContainer) {
            this.tabContainer.addEventListener('click', (event) => {
                const target = event.target.closest('.tab-button');
                if (target && !target.disabled) {
                    this._setActiveTab(target.id);
                }
            });
        }

        const panelToggle = document.getElementById(DOM_IDS.FUNCTION_PANEL_TOGGLE);
        if (panelToggle) {
            panelToggle.addEventListener('click', () => {
                if (!this.panelElement.classList.contains('is-expanded')) {
                    this._setActiveTab('f1-tab');
                }
            });
        }

        // [MODIFIED] Re-subscribe to the FOCUS_ELEMENT event to restore focus management.
        this.eventAggregator.subscribe(EVENTS.FOCUS_ELEMENT, ({ elementId }) => {
            const element = this.panelElement.querySelector(`#${elementId}`);
            if (element) {
                element.focus();
                element.select();
            }
        });
    }

    render(state) {
        this.state = state; // Cache the latest state
        
        if (this.activeView && typeof this.activeView.render === 'function') {
            this.activeView.render(state);
        }
    }

    _setActiveTab(tabId) {
        const targetContentId = document.getElementById(tabId)?.dataset.tabTarget;
        if (!targetContentId) return;

        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.id === tabId);
        });

        this.tabContents.forEach(content => {
            content.classList.toggle('active', `#${content.id}` === targetContentId);
        });

        this.activeView = this.views[tabId];

        if (this.activeView && typeof this.activeView.activate === 'function') {
            this.activeView.activate();
        }
    }
}