// File: 04-core-code/ui/views/f1-cost-view.js

import { EVENTS, DOM_IDS } from '../../config/constants.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F1 (Cost) tab.
 */
export class F1CostView {
    constructor({ panelElement, eventAggregator, calculationService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.calculationService = calculationService;

        this._cacheF1Elements();
        this._initializeF1Listeners();
        console.log("F1CostView Initialized.");
    }

    _cacheF1Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f1 = {
            inputs: {
                'discount': query(`#${DOM_IDS.F1_RB_DISCOUNT_INPUT}`),
            },
            displays: {
                qty: {
                    'winder': query(`#${DOM_IDS.F1_QTY_WINDER}`),
                    'motor': query(`#${DOM_IDS.F1_QTY_MOTOR}`),
                    'remote-1ch': query(`#${DOM_IDS.F1_QTY_REMOTE_1CH}`),
                    'remote-16ch': query(`#${DOM_IDS.F1_QTY_REMOTE_16CH}`),
                    'charger': query(`#${DOM_IDS.F1_QTY_CHARGER}`),
                    '3m-cord': query(`#${DOM_IDS.F1_QTY_3M_CORD}`),
                    'dual-combo': query(`#${DOM_IDS.F1_QTY_DUAL_COMBO}`),
                    'slim': query(`#${DOM_IDS.F1_QTY_SLIM}`),
                },
                price: {
                    'winder': query(`#${DOM_IDS.F1_PRICE_WINDER}`),
                    'motor': query(`#${DOM_IDS.F1_PRICE_MOTOR}`),
                    'remote-1ch': query(`#${DOM_IDS.F1_PRICE_REMOTE_1CH}`),
                    'remote-16ch': query(`#${DOM_IDS.F1_PRICE_REMOTE_16CH}`),
                    'charger': query(`#${DOM_IDS.F1_PRICE_CHARGER}`),
                    '3m-cord': query(`#${DOM_IDS.F1_PRICE_3M_CORD}`),
                    'dual-combo': query(`#${DOM_IDS.F1_PRICE_DUAL_COMBO}`),
                    'slim': query(`#${DOM_IDS.F1_PRICE_SLIM}`),
                    'total': query(`#${DOM_IDS.F1_PRICE_TOTAL}`),
                    'rb-retail': query(`#${DOM_IDS.F1_RB_RETAIL}`),
                    'rb-price': query(`#${DOM_IDS.F1_RB_PRICE}`),
                    'sub-total': query(`#${DOM_IDS.F1_SUB_TOTAL}`),
                    'gst': query(`#${DOM_IDS.F1_GST}`),
                    'final-total': query(`#${DOM_IDS.F1_FINAL_TOTAL}`),
                }
            }
        };
    }

    _initializeF1Listeners() {
        const remote1chQtyDiv = this.f1.displays.qty['remote-1ch'];
        if (remote1chQtyDiv) {
            remote1chQtyDiv.addEventListener('click', () => this.eventAggregator.publish(EVENTS.USER_REQUESTED_REMOTE_DISTRIBUTION));
        }

        const slimQtyDiv = this.f1.displays.qty['slim'];
        if (slimQtyDiv) {
            slimQtyDiv.addEventListener('click', () => this.eventAggregator.publish(EVENTS.USER_REQUESTED_DUAL_DISTRIBUTION));
        }

        const discountInput = this.f1.inputs['discount'];
        if (discountInput) {
            discountInput.addEventListener('input', (event) => {
                const percentage = parseFloat(event.target.value) || 0;
                this.eventAggregator.publish(EVENTS.F1_DISCOUNT_CHANGED, { percentage });
            });

            // [MODIFIED] Add keydown listener to handle Enter/Tab key press
            discountInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    event.target.blur(); // Lose focus
                }
            });
        }
    }

    render(state) {
        if (!this.f1 || !state || !state.quoteData || !state.ui) return;

        const { quoteData, ui } = state;
        const items = quoteData.products.rollerBlind.items;
        const formatPrice = (price) => (typeof price === 'number' && price > 0 ? `$${price.toFixed(2)}` : '');
        const formatDisplay = (value) => (value !== null && value !== undefined) ? value : '';

        // --- Component Cost Calculation ---
        const componentPrices = {};
        const winderQty = items.filter(item => item.winder === 'HD').length;
        componentPrices.winder = this.calculationService.calculateF1ComponentPrice('winder', winderQty);
        this.f1.displays.qty.winder.textContent = winderQty;

        const motorQty = items.filter(item => !!item.motor).length;
        componentPrices.motor = this.calculationService.calculateF1ComponentPrice('motor', motorQty);
        this.f1.displays.qty.motor.textContent = motorQty;

        const totalRemoteQty = ui.driveRemoteCount || 0;
        const remote1chQty = ui.f1.remote_1ch_qty;
        const remote16chQty = (ui.f1.remote_1ch_qty === null) ? totalRemoteQty : (totalRemoteQty - remote1chQty);
        componentPrices['remote-1ch'] = this.calculationService.calculateF1ComponentPrice('remote-1ch', remote1chQty);
        componentPrices['remote-16ch'] = this.calculationService.calculateF1ComponentPrice('remote-16ch', remote16chQty);
        this.f1.displays.qty['remote-1ch'].textContent = remote1chQty;
        this.f1.displays.qty['remote-16ch'].textContent = remote16chQty;

        const chargerQty = ui.driveChargerCount || 0;
        componentPrices.charger = this.calculationService.calculateF1ComponentPrice('charger', chargerQty);
        this.f1.displays.qty.charger.textContent = chargerQty;

        const cordQty = ui.driveCordCount || 0;
        componentPrices['3m-cord'] = this.calculationService.calculateF1ComponentPrice('3m-cord', cordQty);
        this.f1.displays.qty['3m-cord'].textContent = cordQty;
        
        const totalDualPairs = Math.floor(items.filter(item => item.dual === 'D').length / 2);
        const comboQty = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const slimQty = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;
        componentPrices['dual-combo'] = this.calculationService.calculateF1ComponentPrice('dual-combo', comboQty);
        componentPrices.slim = this.calculationService.calculateF1ComponentPrice('slim', slimQty);
        this.f1.displays.qty['dual-combo'].textContent = comboQty;
        this.f1.displays.qty.slim.textContent = slimQty;

        for (const [key, price] of Object.entries(componentPrices)) {
            if (this.f1.displays.price[key]) {
                this.f1.displays.price[key].textContent = formatPrice(price);
            }
        }
        const componentTotal = Object.values(componentPrices).reduce((sum, price) => sum + price, 0);
        this.f1.displays.price.total.textContent = formatPrice(componentTotal);

        // --- RB Pricing Calculation ---
        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discountPercentage = ui.f1.discountPercentage || 0;
        const rbPrice = retailTotal * (1 - (discountPercentage / 100));

        this.f1.displays.price['rb-retail'].textContent = formatPrice(retailTotal);
        if (document.activeElement !== this.f1.inputs.discount) {
            this.f1.inputs.discount.value = formatDisplay(discountPercentage) || '';
        }
        this.f1.displays.price['rb-price'].textContent = formatPrice(rbPrice);

        // --- Final Summary Calculation ---
        const subTotal = componentTotal + rbPrice;
        const gst = subTotal * 0.10;
        const finalTotal = subTotal + gst;

        this.f1.displays.price['sub-total'].textContent = formatPrice(subTotal);
        this.f1.displays.price.gst.textContent = formatPrice(gst);
        this.f1.displays.price['final-total'].textContent = formatPrice(finalTotal);
    }

    activate() {
        this.eventAggregator.publish(EVENTS.F1_TAB_ACTIVATED);
        // [MODIFIED] Set default focus when the tab becomes active.
        this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: DOM_IDS.F1_RB_DISCOUNT_INPUT });
    }
}