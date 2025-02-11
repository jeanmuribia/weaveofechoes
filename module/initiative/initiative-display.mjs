// Dans InitiativeDisplay
export class InitiativeDisplay extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'initiative-display',
            template: 'systems/weave_of_echoes/templates/initiative/initiative-display.hbs',
            popOut: true,
            minimizable: true,
            resizable: true,
            width: 800,
            height: "auto",
            classes: ['initiative-display-window'],
            title: 'Initiative Display',
            tabs: [{
                navSelector: ".display-tabs",
                contentSelector: ".display-content",
                initial: "initiative"
            }]
        });
    }

    constructor() {
        super();
        this.currentCards = [];
        this.currentOpportunities = [];
        this.isAnimating = false;
        this.activeTab = "initiative";
        
        // Un seul hook pour tout gérer
        Hooks.on('updateInitiativeTracker', this._onUpdate.bind(this));
    }


    async _onUpdate(data) {

    
        if (data.opportunities) {
            this.currentOpportunities = data.opportunities;
        }
    
        if (data.drawnInitiative) {
            const oldCards = [...this.currentCards];
            const isInitialDraw = oldCards.length === 0;
    
            this.currentCards = data.drawnInitiative;
            
            await this.render(true);
    
            // Animation uniquement si on est dans l'onglet initiative
            if (this.activeTab === "initiative") {
                const cards = this.element.find('.display-cards-container .display-card');
                if (isInitialDraw && cards.length > 0) {
                    await this._animateInitialDraw(cards);
                }
            }
        } else {
            await this.render(true);
        }
    }
    
    async _handleUpdate(data) {


        if (data.opportunities) {
            this.currentOpportunities = data.opportunities;
        }

        if (data.drawnInitiative) {
            const oldCards = [...this.currentCards];
            const movedCards = this._findMovedCards(oldCards, data.drawnInitiative);
            const isInitialDraw = oldCards.length === 0;

            this.currentCards = data.drawnInitiative;
            
            await this.render(true);

            if (this.activeTab === "initiative") {
                if (isInitialDraw) {
                    await this._animateInitialDraw();
                } else if (movedCards.length > 0) {
                    await this._animateCardMovement(movedCards, oldCards);
                }
            }
        } else {
            await this.render(true);
        }
    }

    async _animateInitialDraw() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const cards = this.element.find('.display-cards-container .display-card');
        if (!cards.length) return;

        cards.css({
            opacity: 0,
            transform: 'translateY(20px)',
            transition: 'none'
        });

        cards[0].offsetHeight; // Force reflow

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            $(card).css({
                transition: 'all 0.2s ease-out',
                opacity: 1,
                transform: 'translateY(0)'
            });
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.isAnimating = false;
    }

    _findMovedCards(oldCards, newCards) {
        const movedCards = [];
        const oldPositions = new Map(oldCards.map((card, index) => [card.id, index]));

        newCards.forEach((card, newIndex) => {
            const oldIndex = oldPositions.get(card.id);
            if (oldIndex !== undefined && oldIndex !== newIndex) {
                movedCards.push({
                    id: card.id,
                    oldIndex,
                    newIndex
                });
            }
        });

        return movedCards;
    }

    async _animateCardMovement(movedCards, oldCards) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const cards = this.element.find('.display-card');
        const CARD_WIDTH = 160;
        const CARD_GAP = 20;

        cards.css({
            position: 'absolute',
            transition: 'none'
        });

        cards.each((index, card) => {
            const $card = $(card);
            const cardId = $card.data('cardId');
            const oldIndex = oldCards.findIndex(c => c.id === cardId);
            
            if (oldIndex !== -1) {
                $card.css({
                    left: `${oldIndex * (CARD_WIDTH + CARD_GAP)}px`
                });
            }
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        cards.css({
            transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        cards.each((index, card) => {
            $(card).css({
                left: `${index * (CARD_WIDTH + CARD_GAP)}px`
            });
        });

        await new Promise(resolve => setTimeout(resolve, 400));

        cards.css({
            position: '',
            transition: '',
            left: ''
        });

        this.isAnimating = false;
    }

    getData() {
        return {
            cards: this.currentCards || [],
            opportunities: this.currentOpportunities || [],
            activeTab: this.activeTab
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        const tabs = new Tabs({
            navSelector: ".display-tabs",
            contentSelector: ".display-content",
            initial: this.activeTab,
            callback: (event, html, tab) => {
                this.activeTab = tab;
            }
        });
        tabs.bind(html[0]);

        this._setupContainerStyles(html);
    }

    _setupContainerStyles(html) {
        const containers = html.find('.display-cards-container');
        containers.css({
            display: 'flex',
            gap: '20px',
            padding: '10px 5px',
            overflowX: 'auto',
            overflowY: 'hidden',
            minHeight: '220px',
            width: '100%',
            position: 'relative'
        });
    }

    close(options={}) {
        Hooks.off('updateInitiativeTracker', this._handleUpdate);
        return super.close(options);
    }
}