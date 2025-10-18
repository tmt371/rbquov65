// File: 04-core-code/services/workflow-service.js

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import { paths } from '../config/paths.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';

/**
 * @fileoverview A dedicated service for coordinating complex, multi-step user workflows.
 * This service takes complex procedural logic out of the AppController.
 */
export class WorkflowService {
    constructor({ eventAggregator, stateService, fileService, calculationService, productFactory, detailConfigView }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;

        this.f2InputSequence = [
            'f2-b10-wifi-qty', 'f2-b13-delivery-qty', 'f2-b14-install-qty',
            'f2-b15-removal-qty', 'f2-b17-mul-times', 'f2-b18-discount'
        ];
        
        console.log("WorkflowService Initialized.");
    }

    async handlePrintableQuoteRequest() {
        const state = this.stateService.getState();
        const f3Inputs = this._getF3InputValues();
        const finalQuoteData = this._mergeF3Overrides(state, f3Inputs);

        try {
            const [quoteTemplate, detailTemplate] = await Promise.all([
                fetch(paths.partials.quoteTemplate).then(res => res.text()),
                fetch(paths.partials.detailedItemList).then(res => res.text())
            ]);

            let populatedQuote = this._populateQuoteTemplate(quoteTemplate, finalQuoteData, f3Inputs);
            let populatedDetail = this._populateDetailTemplate(detailTemplate, finalQuoteData);

            const finalHtml = `
                <div class="preview-content-area">
                    <div class="preview-actions">
                        <button id="preview-btn-print" class="btn-print">Print / Save as PDF</button>
                        <button id="preview-btn-json" class="btn-download">Download JSON</button>
                        <button id="preview-btn-csv" class="btn-download">Download CSV</button>
                        <button id="preview-btn-save" class="btn-save-cloud" disabled>Save to Cloud</button>
                        <button id="preview-btn-close" class="btn-close">Close</button>
                    </div>
                    <div class="preview-scroll-container">
                        ${populatedQuote}
                        <div class="page-break-before"></div>
                        ${populatedDetail}
                    </div>
                </div>`;
            
            const overlay = document.getElementById(DOM_IDS.QUOTE_PREVIEW_OVERLAY);
            overlay.innerHTML = finalHtml;
            overlay.classList.remove('is-hidden');

            this._bindPreviewActions(finalQuoteData);

        } catch (error) {
            console.error('Failed to generate printable quote:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Error generating quote preview.', type: 'error' });
        }
    }

    _getF3InputValues() {
        const queryValue = (id) => document.getElementById(id)?.value || '';
        return {
            quoteId: queryValue('f3-quote-id'),
            issueDate: queryValue('f3-issue-date'),
            dueDate: queryValue('f3-due-date'),
            customerName: queryValue('f3-customer-name'),
            customerAddress: queryValue('f3-customer-address'),
            customerPhone: queryValue('f3-customer-phone'),
            customerEmail: queryValue('f3-customer-email'),
            finalOfferPrice: queryValue('f3-final-offer-price'),
            generalNotes: queryValue('f3-general-notes'),
            termsConditions: queryValue('f3-terms-conditions'),
        };
    }

    _mergeF3Overrides(state, f3Inputs) {
        let finalState = JSON.parse(JSON.stringify(state));

        // Override customer info
        finalState.quoteData.customer.name = f3Inputs.customerName || finalState.quoteData.customer.name;
        finalState.quoteData.customer.address = f3Inputs.customerAddress || finalState.quoteData.customer.address;
        finalState.quoteData.customer.phone = f3Inputs.customerPhone || finalState.quoteData.customer.phone;
        finalState.quoteData.customer.email = f3Inputs.customerEmail || finalState.quoteData.customer.email;

        // Override quote details
        finalState.quoteData.quoteId = f3Inputs.quoteId || finalState.quoteData.quoteId;
        finalState.quoteData.issueDate = f3Inputs.issueDate || finalState.quoteData.issueDate;
        finalState.quoteData.dueDate = f3Inputs.dueDate || finalState.quoteData.dueDate;

        // Override final price if provided
        if (f3Inputs.finalOfferPrice && !isNaN(parseFloat(f3Inputs.finalOfferPrice))) {
            const finalPrice = parseFloat(f3Inputs.finalOfferPrice);
            const gst = finalPrice / 11;
            const subTotal = finalPrice - gst;
            finalState.ui.f2.gst = finalPrice; // GST incl.
            finalState.ui.f2.netProfit = finalPrice - (state.ui.f1.finalTotal || 0);
            
            // For template placeholders
            finalState.templateOverrides = {
                final_total: `$${finalPrice.toFixed(2)}`,
                gst_amount: `$${gst.toFixed(2)}`,
                sub_total: `$${subTotal.toFixed(2)}`
            };
        }

        return finalState;
    }

    _populateQuoteTemplate(template, state, f3Inputs) {
        const f2 = state.ui.f2;
        const overrides = state.templateOverrides || {};
        
        const formatPrice = (value) => (typeof value === 'number') ? `$${value.toFixed(2)}` : '$0.00';

        let productSummaryRows = `
            <tr>
                <td>Roller Blinds</td>
                <td class="price">${formatPrice(f2.disRbPrice)}</td>
            </tr>
            <tr>
                <td>Installation Accessories</td>
                <td class="price">${formatPrice(f2.acceSum + f2.eAcceSum + f2.surchargeFee)}</td>
            </tr>
        `;

        return template
            .replace('{{quote_id}}', state.quoteData.quoteId)
            .replace('{{issue_date}}', state.quoteData.issueDate)
            .replace('{{due_date}}', state.quoteData.dueDate)
            .replace('{{customer_name}}', state.quoteData.customer.name)
            .replace('{{customer_address}}', state.quoteData.customer.address)
            .replace('{{customer_phone}}', state.quoteData.customer.phone)
            .replace('{{customer_email}}', state.quoteData.customer.email)
            .replace('{{product_summary_rows}}', productSummaryRows)
            .replace('{{sub_total}}', overrides.sub_total || formatPrice(f2.sumPrice))
            .replace('{{gst_amount}}', overrides.gst_amount || formatPrice(f2.gst - f2.sumPrice))
            .replace('{{final_total}}', overrides.final_total || formatPrice(f2.gst))
            .replace('{{notes}}', f3Inputs.generalNotes)
            .replace('{{terms_and_conditions}}', f3Inputs.termsConditions);
    }

    _populateDetailTemplate(template, state) {
        const items = state.quoteData.products[state.quoteData.currentProduct].items;
        let itemRows = items.map((item, index) => {
            if (!item.width && !item.height) return ''; // Skip empty final row
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="text-left">${item.location || ''}</td>
                    <td>${item.width || ''}</td>
                    <td>${item.height || ''}</td>
                    <td>${item.fabricType || ''}</td>
                    <td class="text-left">${item.fabric || ''}</td>
                    <td class="text-left">${item.color || ''}</td>
                    <td>${item.over || ''}</td>
                    <td>${item.oi || ''}</td>
                    <td>${item.lr || ''}</td>
                    <td>${item.dual || ''}</td>
                    <td>${item.chain || ''}</td>
                    <td>${item.winder || ''}</td>
                    <td>${item.motor || ''}</td>
                    <td class="price">${item.linePrice ? `$${item.linePrice.toFixed(2)}` : ''}</td>
                </tr>
            `;
        }).join('');

        return template.replace('{{item_rows}}', itemRows);
    }
    
    _bindPreviewActions(finalState) {
        const overlay = document.getElementById(DOM_IDS.QUOTE_PREVIEW_OVERLAY);
        if (!overlay) return;

        const close = () => overlay.classList.add('is-hidden');

        overlay.querySelector('#preview-btn-close').addEventListener('click', close);
        overlay.querySelector('#preview-btn-print').addEventListener('click', () => window.print());
        
        overlay.querySelector('#preview-btn-json').addEventListener('click', () => {
            this.fileService.saveToJson(finalState.quoteData);
        });

        overlay.querySelector('#preview-btn-csv').addEventListener('click', () => {
            this.fileService.exportToCsv(finalState.quoteData);
        });
        
        // Listener for future cloud save functionality
        overlay.querySelector('#preview-btn-save').addEventListener('click', () => {
             this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Cloud save functionality is not yet implemented.' });
        });
    }

    handleRemoteDistribution() {
        const { ui } = this.stateService.getState();
        const totalRemoteCount = ui.driveRemoteCount || 0;

        const initial1ch = ui.f1.remote_1ch_qty;
        const initial16ch = (ui.f1.remote_16ch_qty === null) ? totalRemoteCount - initial1ch : ui.f1.remote_16ch_qty;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total remotes: ${totalRemoteCount}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: '1-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_1CH, value: initial1ch },
                    { type: 'text', text: '16-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_16CH, value: initial16ch }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qty1ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_1CH).value, 10);
                            const qty16ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_16CH).value, 10);

                            if (isNaN(qty1ch) || isNaN(qty16ch) || qty1ch < 0 || qty16ch < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (qty1ch + qty16ch !== totalRemoteCount) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalRemoteCount}. Current total: ${qty1ch + qty16ch}.`,
                                    type: 'error'
                                });
                                return false;
                            }

                            this.stateService.dispatch(uiActions.setF1RemoteDistribution(qty1ch, qty16ch));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => {} }
                ]
            ],
            onOpen: () => {
                const input1ch = document.getElementById(DOM_IDS.DIALOG_INPUT_1CH);
                const input16ch = document.getElementById(DOM_IDS.DIALOG_INPUT_16CH);

                input1ch.addEventListener('input', () => {
                    const qty1ch = parseInt(input1ch.value, 10);
                    if (!isNaN(qty1ch) && qty1ch >= 0 && qty1ch <= totalRemoteCount) {
                        input16ch.value = totalRemoteCount - qty1ch;
                    }
                });

                input16ch.addEventListener('input', () => {
                    const qty16ch = parseInt(input16ch.value, 10);
                    if (!isNaN(qty16ch) && qty16ch >= 0 && qty16ch <= totalRemoteCount) {
                        input1ch.value = totalRemoteCount - qty16ch;
                    }
                });

                setTimeout(() => {
                    input1ch.focus();
                    input1ch.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    handleDualDistribution() {
        const { quoteData, ui } = this.stateService.getState();
        const items = quoteData.products[quoteData.currentProduct].items;
        const totalDualPairs = Math.floor(items.filter(item => item.dual === 'D').length / 2);
    
        const initialCombo = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const initialSlim = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;
    
        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total Dual pairs: ${totalDualPairs}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: 'Combo Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_COMBO, value: initialCombo },
                    { type: 'text', text: 'Slim Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_SLIM, value: initialSlim }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qtyCombo = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO).value, 10);
                            const qtySlim = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM).value, 10);
    
                            if (isNaN(qtyCombo) || isNaN(qtySlim) || qtyCombo < 0 || qtySlim < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }
    
                            if (qtyCombo + qtySlim !== totalDualPairs) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalDualPairs}. Current total: ${qtyCombo + qtySlim}.`,
                                    type: 'error'
                                });
                                return false;
                            }
    
                            this.stateService.dispatch(uiActions.setF1DualDistribution(qtyCombo, qtySlim));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => {} }
                ]
            ],
            onOpen: () => {
                const inputCombo = document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO);
                const inputSlim = document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM);
    
                inputSlim.addEventListener('input', () => {
                    const qtySlim = parseInt(inputSlim.value, 10);
                    if (!isNaN(qtySlim) && qtySlim >= 0 && qtySlim <= totalDualPairs) {
                        inputCombo.value = totalDualPairs - qtySlim;
                    }
                });
    
                inputCombo.addEventListener('input', () => {
                    const qtyCombo = parseInt(inputCombo.value, 10);
                    if (!isNaN(qtyCombo) && qtyCombo >= 0 && qtyCombo <= totalDualPairs) {
                        inputSlim.value = totalDualPairs - qtyCombo;
                    }
                });
    
                setTimeout(() => {
                    inputSlim.focus();
                    inputSlim.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);
        
        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
    }

    handleF2TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);
        
        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
        
        this.detailConfigView.driveAccessoriesView.recalculateAllDriveAccessoryPrices();
        this.detailConfigView.dualChainView._calculateAndStoreDualPrice();
        
        this._calculateF2Summary();
        
        this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: 'f2-b10-wifi-qty' });
    }

    handleNavigationToDetailView() {
        const { ui } = this.stateService.getState();
        if (ui.currentView === 'QUICK_QUOTE') {
            this.stateService.dispatch(uiActions.setCurrentView('DETAIL_CONFIG'));
            this.detailConfigView.activateTab('k1-tab'); 
        } else {
            this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
            this.stateService.dispatch(uiActions.setVisibleColumns(initialState.ui.visibleColumns));
        }
    }

    handleNavigationToQuickQuoteView() {
        this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
        this.stateService.dispatch(uiActions.setVisibleColumns(initialState.ui.visibleColumns));
    }

    handleTabSwitch({ tabId }) {
        this.detailConfigView.activateTab(tabId);
    }

    handleUserRequestedLoad() {
        const { quoteData } = this.stateService.getState();
        const productKey = quoteData.currentProduct;
        const items = quoteData.products[productKey] ? quoteData.products[productKey].items : [];
        const hasData = items.length > 1 || (items.length === 1 && (items[0].width || items[0].height));

        if (hasData) {
            this.eventAggregator.publish(EVENTS.SHOW_LOAD_CONFIRMATION_DIALOG);
        } else {
            this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
        }
    }

    handleLoadDirectly() {
        this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
    }

    handleFileLoad({ fileName, content }) {
        const result = this.fileService.parseFileContent(fileName, content);
        if (result.success) {
            this.stateService.dispatch(quoteActions.setQuoteData(result.data));
            this.stateService.dispatch(uiActions.resetUi());
            this.stateService.dispatch(uiActions.setSumOutdated(true));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message });
        } else {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message, type: 'error' });
        }
    }

    handleF1DiscountChange({ percentage }) {
        this.stateService.dispatch(uiActions.setF1DiscountPercentage(percentage));
    }

    handleToggleFeeExclusion({ feeType }) {
        this.stateService.dispatch(uiActions.toggleF2FeeExclusion(feeType));
        this._calculateF2Summary();
    }

    handleF2ValueChange({ id, value }) {
        const numericValue = value === '' ? null : parseFloat(value);
        let keyToUpdate = null;

        switch (id) {
            case 'f2-b10-wifi-qty': keyToUpdate = 'wifiQty'; break;
            case 'f2-b13-delivery-qty': keyToUpdate = 'deliveryQty'; break;
            case 'f2-b14-install-qty': keyToUpdate = 'installQty'; break;
            case 'f2-b15-removal-qty': keyToUpdate = 'removalQty'; break;
            case 'f2-b17-mul-times': keyToUpdate = 'mulTimes'; break;
            case 'f2-b18-discount': keyToUpdate = 'discount'; break;
        }

        if (keyToUpdate) {
            this.stateService.dispatch(uiActions.setF2Value(keyToUpdate, numericValue));
            this._calculateF2Summary();
        }
    }

    focusNextF2Input(currentId) {
        const currentIndex = this.f2InputSequence.indexOf(currentId);
        if (currentIndex > -1) {
            const nextIndex = (currentIndex + 1) % this.f2InputSequence.length;
            const nextElementId = this.f2InputSequence[nextIndex];
            this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: nextElementId });
        }
    }

    _calculateF2Summary() {
        const { quoteData, ui } = this.stateService.getState();
        const summaryValues = this.calculationService.calculateF2Summary(quoteData, ui);

        for (const key in summaryValues) {
            this.stateService.dispatch(uiActions.setF2Value(key, summaryValues[key]));
        }
    }
}