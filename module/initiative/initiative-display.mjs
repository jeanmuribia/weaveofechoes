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
            title: 'Initiative Display'
        });
    }

    constructor() {
        super();
        this.currentCards = [];
        this.isAnimating = false;
    }

    getData() {
        return { cards: this.currentCards };
    }

    async updateDisplay(newCards) {
        console.log("UpdateDisplay triggered with:", newCards);
        if (this.isAnimating) return;
        this.isAnimating = true;

        const oldCards = [...this.currentCards];
        this.currentCards = newCards || [];

        await this.render(true);
        
        if (oldCards.length === 0 && this.currentCards.length > 0) {
            await this._animateInitialDraw();
        } else if (this._isEndTurn(oldCards, this.currentCards)) {
            await this._animateEndTurn();
        }

        this.isAnimating = false;
    }

    _isEndTurn(oldCards, newCards) {
        if (!oldCards.length || !newCards.length) return false;
        return oldCards[0].id === newCards[newCards.length - 1].id;
    }

    async _animateInitialDraw() {
        const container = this.element.find('.display-cards-container');
        if (!container.length) return;

        const cards = container.find('.display-card').toArray();
        const startX = container.width() - 180;

        // Stack cards initially
        for (let i = 0; i < cards.length; i++) {
            const card = $(cards[i]);
            card.css({
                position: 'absolute',
                right: '20px',
                top: '20px',
                zIndex: cards.length - i,
                transform: `rotate(${(i * 2) - 5}deg)`,
                opacity: 0
            });
        }

        // Force reflow
        container[0].offsetHeight;

        // Deal cards one by one
        for (let i = 0; i < cards.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const card = $(cards[i]);
                    card.css({
                        transition: 'all 0.5s ease-out',
                        position: 'relative',
                        right: '0',
                        top: '0',
                        transform: 'rotate(0)',
                        opacity: 1,
                        zIndex: 1
                    });

                    resolve();
                }, i * 200);
            });
        }
    }

    async _animateEndTurn() {
        const container = this.element.find('.display-cards-container');
        if (!container.length) return;

        const cards = container.find('.display-card');
        const firstCard = cards.first();
        const cardWidth = firstCard.outerWidth(true);
        const distance = (cards.length - 1) * cardWidth;

        // Move first card to end
        firstCard.css({
            position: 'relative',
            transition: 'transform 0.5s ease-out',
            transform: `translateX(${distance}px)`,
            zIndex: 10
        });

        // Move other cards left
        cards.slice(1).each(function() {
            $(this).css({
                position: 'relative',
                transition: 'transform 0.5s ease-out',
                transform: 'translateX(-100%)'
            });
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        await this.render(false);
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Setup animation classes
        html.find('.display-card').each((i, card) => {
            if (i === 0) { // First card
                $(card).css({
                    animation: this.currentCards[0]?.isActive ? 'activePulse 2s infinite' : 'none'
                });
            }
        });
    }
}