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
        if (this.isAnimating || !newCards) return;
        this.isAnimating = true;
    
        console.log("1. Début updateDisplay");
    
        const isInitialDraw = this.currentCards.length === 0 && newCards.length > 0;
        const movedCards = this._findMovedCards(this.currentCards, newCards);
        console.log("2. Type d'animation:", isInitialDraw ? "Initial Draw" : "Card Movement", movedCards);
    
        const oldCards = [...this.currentCards];
        this.currentCards = newCards;
        console.log("3. Données mises à jour");
    
        console.log("4. Avant render");
        await this.render(true);
        console.log("5. Après render");
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log("6. Après timeout");
    
        const container = this.element.find('.display-cards-container');
        const cards = container.find('.display-card');
    
        if (isInitialDraw) {
            console.log("7A. Début animation initiale");
            await this._animateInitialDraw(cards);
            console.log("8A. Fin animation initiale");
        } else if (movedCards.length > 0) {
            console.log("7B. Début animation mouvement");
            await this._animateCardMovement(cards, movedCards, oldCards);
            console.log("8B. Fin animation mouvement");
        }
    
        this.isAnimating = false;
        console.log("9. Fin updateDisplay");
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

    async _animateInitialDraw(cards) {
        cards.css({
            opacity: 0,
            transform: 'translateY(20px)',
            transition: 'none'
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            await new Promise(resolve => {
                setTimeout(() => {
                    $(card).css({
                        transition: 'all 0.3s ease-out',
                        opacity: 1,
                        transform: 'translateY(0)'
                    });
                    resolve();
                }, i * 100);
            });
        }
    }

    async _animateCardMovement(cards, movedCards, oldCards) {
        console.log("Animation - Début configuration");
        
        const CARD_DIMENSIONS = {
            width: 160,
            height: 190
        };
        
        const container = this.element.find('.display-cards-container');
        
        console.log("Animation - Fixation dimensions");
        cards.each((index, card) => {
            const $card = $(card);
            $card.css({
                transition: 'none',
                width: `${CARD_DIMENSIONS.width}px`,
                height: `${CARD_DIMENSIONS.height}px`,
                flex: '0 0 auto'
            });
        });
    
        container[0].offsetHeight;
        console.log("Animation - Positions initiales");
    
        cards.each((index, card) => {
            const $card = $(card);
            const cardId = $card.data('cardId');
            const oldIndex = oldCards.findIndex(c => c.id === cardId);
            
            if (oldIndex !== -1) {
                $card.css({
                    position: 'absolute',
                    left: `${oldIndex * (CARD_DIMENSIONS.width + 20)}px`
                });
            }
        });
    
        console.log("Animation - Attente avant transition");
        await new Promise(resolve => setTimeout(resolve, 50));
    
        console.log("Animation - Configuration transition");
        cards.css({
            transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'absolute'
        });
    
        console.log("Animation - Application nouvelles positions");
        cards.each((index, card) => {
            $(card).css({
                left: `${index * (CARD_DIMENSIONS.width + 20)}px`
            });
        });
    
        console.log("Animation - Attente fin transition");
        await new Promise(resolve => setTimeout(resolve, 400));
    
        console.log("Animation - Reset styles");
        cards.css({
            transition: '',
            position: '',
            left: ''
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        const container = html.find('.display-cards-container');
        
        // Style pour le conteneur scrollable
        container.css({
            display: 'flex',
            gap: '20px',
            padding: '10px 5px',
            overflowX: 'auto',
            overflowY: 'hidden',
            minHeight: '220px',
            width: '100%',
            position: 'relative'
        });

        // Ajout d'une règle CSS pour la scrollbar
        const style = document.createElement('style');
        style.textContent = `
            .display-cards-container::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            .display-cards-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            .display-cards-container::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 4px;
            }
            .display-cards-container::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            .display-cards-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
    }
}