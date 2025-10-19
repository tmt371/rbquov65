// File: 04-core-code/ui/views/quick-quote-view.spec.js

import { QuickQuoteView } from './quick-quote-view.js';
import { EVENTS } from '../../config/constants.js';

describe('QuickQuoteView', () => {
    let quickQuoteView;
    let mockStateService;
    let mockCalculationService;
    let mockEventAggregator;
    let mockFocusService;
    let mockProductFactory;

    beforeEach(() => {
        mockStateService = {
            getState: jest.fn(),
            dispatch: jest.fn(),
        };
        mockCalculationService = {
            calculateAndSum: jest.fn(),
        };
        mockEventAggregator = {
            publish: jest.fn(),
        };
        mockFocusService = {
            focusAfterDelete: jest.fn(),
        };
        mockProductFactory = {
            getProductStrategy: jest.fn(),
        };

        quickQuoteView = new QuickQuoteView({
            stateService: mockStateService,
            calculationService: mockCalculationService,
            eventAggregator: mockEventAggregator,
            focusService: mockFocusService,
            productFactory: mockProductFactory,
            fileService: {},
            configManager: {},
        });
    });

    describe('handleInsertRow', () => {
        it('should dispatch insertRow and setActiveCell actions when a valid row is selected', () => {
            mockStateService.getState.mockReturnValue({
                ui: { multiSelectSelectedIndexes: [0] },
                quoteData: {
                    currentProduct: 'roller',
                    products: {
                        roller: {
                            items: [
                                { width: 100, height: 100 },
                                { width: 200, height: 200 },
                                { width: null, height: null }
                            ]
                        }
                    }
                }
            });

            quickQuoteView.handleInsertRow();

            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote/insertRow', payload: { selectedIndex: 0 } }));
            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ui/setActiveCell', payload: { rowIndex: 1, column: 'width' } }));
        });
    });

    describe('handleCalculateAndSum', () => {
        it('should dispatch setQuoteData and setSumOutdated(false) when calculation is successful', () => {
            const mockQuoteData = { currentProduct: 'roller', products: { roller: { items: [] } } };
            const mockSuccessResult = { updatedQuoteData: mockQuoteData, firstError: null };
            mockStateService.getState.mockReturnValue({ quoteData: mockQuoteData });
            mockCalculationService.calculateAndSum.mockReturnValue(mockSuccessResult);
            mockProductFactory.getProductStrategy.mockReturnValue({});

            quickQuoteView.handleCalculateAndSum();

            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote/setQuoteData', payload: { newQuoteData: mockQuoteData } }));
            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ui/setSumOutdated', payload: { isOutdated: false } }));
            expect(mockEventAggregator.publish).not.toHaveBeenCalled();
        });

        it('should dispatch actions and publish notification when calculation fails', () => {
            const mockQuoteData = { currentProduct: 'roller', products: { roller: { items: [] } } };
            const mockError = { message: 'Test Error', rowIndex: 1, column: 'width' };
            const mockErrorResult = { updatedQuoteData: mockQuoteData, firstError: mockError };
            mockStateService.getState.mockReturnValue({ quoteData: mockQuoteData });
            mockCalculationService.calculateAndSum.mockReturnValue(mockErrorResult);
            mockProductFactory.getProductStrategy.mockReturnValue({});

            quickQuoteView.handleCalculateAndSum();

            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote/setQuoteData' }));
            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ui/setSumOutdated', payload: { isOutdated: true } }));
            expect(mockEventAggregator.publish).toHaveBeenCalledWith(EVENTS.SHOW_NOTIFICATION, { message: 'Test Error', type: 'error' });
            expect(mockStateService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ui/setActiveCell', payload: { rowIndex: 1, column: 'width' } }));
        });
    });
});
