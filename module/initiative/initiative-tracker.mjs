export class InitiativeTracker extends Application {
    static MAX_OPPORTUNITY_NAME_LENGTH = 20;
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'initiative-tracker',
            template: 'systems/weave_of_echoes/templates/initiative/initiative-tracker.hbs',
            title: 'Initiative Tracker',
            width: 720,
            height: 800,
            resizable: true,
            classes: ['initiative-tracker-window'],
            tabs: [{
                navSelector: ".tracker-tabs",
                contentSelector: ".tab-content",
                initial: "initiative"
            }]
        });
    }

    static initialize() {
        game.weaveOfEchoes = game.weaveOfEchoes || {};
        game.weaveOfEchoes.InitiativeTracker = this;
        game.weaveOfEchoes.InitiativeDisplay = InitiativeDisplay;
    }
    

    constructor() {
        super();

        this.initiativeGroups = [{
            id: foundry.utils.randomID(),
            name: "Group 1",
            characters: []
        }];
        this.selectedCharacters = [];
        this.drawnInitiative = [];
        this.isInitiativeDrawn = false;
        this.setupCollapsed = false;
        this.initiativeCollapsed = false;
        this.alertsEnabled = true; // Nouvelle propriété pour gérer les alertes
        this.opportunities = [];
        this.currentTab="initiative";
    }

    getData(options = {}) {
        const data = super.getData(options);
        
        return {
            initiativeGroups: this.initiativeGroups,
            selectedCharacters: this.selectedCharacters,
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn,
            setupCollapsed: this.setupCollapsed,
            initiativeCollapsed: this.initiativeCollapsed,
            alertsEnabled: this.alertsEnabled,
            opportunities: this.opportunities,  
            currentTab: this._currentTab
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
    
        // Initialisation des onglets
    const tabs = new Tabs({
        navSelector: ".tabs",
        contentSelector: ".sheet-body",
        initial: "initiative",
        callback: (event, html, tab) => {
            // Callback optionnel lors du changement d'onglet
            console.log(`Tab changed to: ${tab}`);
        }
    });
    tabs.bind(html[0]);
    
        // Écouteurs d'événements pour les contrôles de l'onglet Initiative
        html.on('click', '.add-characters', this._onAddCharacters.bind(this));
        html.on('click', '.add-group', this._onAddGroup.bind(this));
        html.on('click', '.draw-initiative', this._onDrawInitiative.bind(this));
        html.on('click', '.delete-group', this._onDeleteGroup.bind(this));
        html.on('click', '.delete-char', this._onDeleteCharacter.bind(this));
        html.on('click', '.duplicate-char', this._onDuplicateCharacter.bind(this));
        html.on('click', '.toggle-setup', this._onToggleSetup.bind(this));
        html.on('click', '.toggle-initiative', this._onToggleInitiative.bind(this));
    
        // Écouteurs d'événements pour les cartes d'initiative
        html.on('click', '.expand-button', this._onExpandCard.bind(this));
        html.on('click', '.threat-button', this._onAddThreat.bind(this));
        html.on('click', '.threat-counter', this._onRemoveThreat.bind(this));
        html.on('click', '.ko-button', this._onToggleKO.bind(this));
        html.on('click', '.delete-card', this._onDeleteCard.bind(this));
        html.on('click', '.end-turn-button', this._onEndTurn.bind(this));
        html.on('change', '.toggle-active', this._onToggleActive.bind(this));
        html.on('click', '.end-action-button', this._onEndAction.bind(this));
    
        // Gestion des alertes
        html.on('click', '.toggle-alerts', () => this._toggleAlerts());
    
        this._setupOpportunityListeners(html)
    
    html.find('.clear-opportunities').on('click', (ev) => {
        ev.preventDefault();
        this._onClearOpportunities(ev);
    });
    
    html.find('.opportunity-name').on('change', (ev) => {
        ev.preventDefault();
        this._onEditOpportunityName(ev);
    });
    
    html.find('.delete-opportunity').on('click', (ev) => {
        ev.preventDefault();
        this._onDeleteOpportunity(ev);
    });
        // Configuration de drag & drop pour les groupes
        this._setupGroupDragDrop(html);
    
        // Configuration de drag & drop et boutons d'initiative rapide si l'initiative est tirée
        if (this.isInitiativeDrawn) {
            this._setupInitiativeCardDragDrop(html);
            this._addQuickInitiativeButton(html);
        }
    }
    
    

    // Modification de la méthode updateState
    async updateState(shouldRender = true) {
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        try {
            // Émettre l'événement de mise à jour avec toutes les données
            await Hooks.callAll('updateInitiativeTracker', {
                drawnInitiative: this.drawnInitiative,
                opportunities: this.opportunities,
                isInitiativeDrawn: this.isInitiativeDrawn
            });
            
            if (shouldRender) {
                await this.render(true);
            }
        } finally {
            this.isUpdating = false;
        }
    }

_checkAndUpdateActiveState() {
    if (!this.drawnInitiative.length) return;

    // Vérifier si la première carte est KO
    if (this.drawnInitiative[0].isKO) {
        // Déplacer la carte KO à la fin
        const [koCard] = this.drawnInitiative.splice(0, 1);
        this.drawnInitiative.push(koCard);

        // Chercher la prochaine carte non-KO
        for (const char of this.drawnInitiative) {
            if (!char.isKO) {
                char.isActive = true;
                break;
            }
        }
    } else if (!this.drawnInitiative.some(c => c.isActive)) {
        // Si aucune carte n'est active et que la première n'est pas KO
        this.drawnInitiative[0].isActive = true;
    }
}

_onEndTurn(event, isAutoPass = false) {
    if (event) event.preventDefault();
    if (!this.drawnInitiative.length) return;

    // Trouver la carte active actuelle
    const activeCard = this.drawnInitiative.find(char => char.isActive);
    if (!activeCard) return;

    // Désactiver la carte et la déplacer à la fin
    activeCard.isActive = false;
    this.drawnInitiative = [
        ...this.drawnInitiative.filter(c => c.id !== activeCard.id),
        activeCard
    ];

    // Vérifier et activer la nouvelle première carte
    this._processNextTurn(isAutoPass);
    this.updateState();
}
    
_processNextTurn(isAutoPass = false) {
    const firstCard = this.drawnInitiative[0];
    if (!firstCard) return;

    if (firstCard.isKO) {
        // Déplacer la carte KO à la fin sans l'activer
        this.drawnInitiative = [
            ...this.drawnInitiative.slice(1),
            firstCard
        ];

        if (this.alertsEnabled && !isAutoPass) {
            ChatMessage.create({
                content: `<div class="initiative-turn-announcement"><h3>${firstCard.name} is KO and skips their turn!</h3></div>`,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                speaker: { alias: "Initiative Tracker" }
            });
        }

        // Récursion pour vérifier la carte suivante
        return this._processNextTurn(isAutoPass);
    } else {
        // Activer la carte non-KO
        firstCard.isActive = true;
        if (this.alertsEnabled && !isAutoPass) {
            ChatMessage.create({
                content: `<div class="initiative-turn-announcement"><h3>${firstCard.name}'s Turn</h3></div>`,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                speaker: { alias: "Initiative Tracker" }
            });
        }
    }
}   
    _onEndAction(event) {
        if (event) event.preventDefault();
    
        // Message de fin d'action
        ChatMessage.create({
            content: `<div class="initiative-announcement"><h2>End of Action!</h2></div>`,
            type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
            speaker: { alias: "Initiative Tracker" }
        });

        // Réinitialiser l'état
        this.drawnInitiative = [];
        this.isInitiativeDrawn = false;


        this.updateState();
    }
    
    
    _announceNewTurn() {
        if (!this.drawnInitiative.length || !this.alertsEnabled) return;
    
        const currentActor = this.drawnInitiative[0];
        if (!currentActor) return;
    
        ChatMessage.create({
            content: `<div class="initiative-announcement"><h3>${currentActor.name}'s Turn</h3></div>`,
            type: CONST.CHAT_MESSAGE_STYLES.OTHER,
            speaker: { alias: "Initiative Tracker" }
        });
    }

    _toggleAlerts() {
        this.alertsEnabled = !this.alertsEnabled;
        ui.notifications.info(`Turn alerts ${this.alertsEnabled ? 'enabled' : 'disabled'}`);
        this.updateState();  
    }

    _onToggleActive(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        const character = this.drawnInitiative.find(c => c.id === cardId);
        if (character) {
            character.isActive = !character.isActive;
        }
        this.updateState();
    }
    

    // Gestion des toggles de section
    _onToggleSetup(event) {
        this.setupCollapsed = !this.setupCollapsed;
        this.render(false);
    }

    _onToggleInitiative(event) {
        this.initiativeCollapsed = !this.initiativeCollapsed;
        this.render(false);
    }

    // Gestion des personnages
    async _onAddCharacters(event) {
        event.preventDefault();
        
        const dialog = new Dialog({
            title: "Select Characters",
            content: this._createCharacterSelectionContent(),
            buttons: {
                confirm: {
                    label: "Confirm",
                    callback: async (html) => {
                        const selectedIds = html.find('input[type="checkbox"]:checked')
                            .map((i, el) => el.dataset.actorId)
                            .get();
                        
                        if (selectedIds.length) {
                            await this._processSelectedActors(selectedIds);
                            this.render(true);
                        }
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "confirm",
            render: html => this._activateCharacterSelectionListeners(html)
        }, {
            width: 400,
            classes: ['character-select-dialog']
        });
        
        dialog.render(true);
    }

    _onDuplicateCharacter(event) {
        const characterId = event.currentTarget.dataset.characterId;
        const originalCharacter = this.selectedCharacters.find(c => c.id === characterId) || 
                                this.initiativeGroups.flatMap(g => g.characters)
                                                   .find(c => c.id === characterId);
        
        if (originalCharacter) {
            const duplicatedCharacter = {
                ...originalCharacter,
                id: foundry.utils.randomID(), // Génère un nouvel ID unique
                name: `${originalCharacter.name} (Copy)` // Ajoute (Copy) au nom
            };
            
            this.selectedCharacters.push(duplicatedCharacter);
            this.render(true);
        }
    }

    _createCharacterSelectionContent() {
        const actors = game.actors.filter(a => 
            (a.type === "character" || a.type === "npc") && 
            !this.selectedCharacters.some(sc => sc.actorId === a.id)
        );

        return `
            <div class="character-select-dialog">
                <div class="character-list">
                    ${actors.map(actor => `
                        <div class="character-select-item">
                            <label class="select-label">
                                <input type="checkbox" data-actor-id="${actor.id}">
                                <span class="selection-name">${actor.name}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _activateCharacterSelectionListeners(html) {
        html.find('[data-action="select-all"]').click(ev => {
            const checkboxes = html.find('input[type="checkbox"]');
            const allChecked = checkboxes.toArray().every(cb => cb.checked);
            checkboxes.prop('checked', !allChecked);
        });

        html.find('[data-action="confirm"]').click(async ev => {
            const selectedIds = html.find('input[type="checkbox"]:checked')
                .map((i, el) => el.dataset.actorId)
                .get();

            if (selectedIds.length) {
                await this._processSelectedActors(selectedIds);
                this.render(true);
            }
            const dialog = ev.currentTarget.closest('.dialog');
            if (dialog) dialog.close();
        });
    }

      // Modification de la méthode pour ajouter directement au premier groupe
      async _processSelectedActors(actorIds) {
        const newCharacters = actorIds.map(id => {
            const actor = game.actors.get(id);
            return {
                id: foundry.utils.randomID(),
                actorId: actor.id,
                name: actor.name,
                img: actor.img
            };
        });

        // Ajouter directement les personnages au premier groupe
        if (this.initiativeGroups.length > 0) {
            if (!this.initiativeGroups[0].characters) {
                this.initiativeGroups[0].characters = [];
            }
            this.initiativeGroups[0].characters.push(...newCharacters);
        }
        this.render(true);
    }

    // Groupe et manipulation des personnages
    _onAddGroup(event) {
        this.initiativeGroups.push({
            id: foundry.utils.randomID(),
            name: `Group ${this.initiativeGroups.length + 1}`,
            characters: []
        });
        this.render(true);
    }

    _onDeleteGroup(event) {
        const groupId = event.currentTarget.closest('.group-container').dataset.groupId;
        if (!groupId) return;
    
        // Trouve le groupe
        const groupIndex = this.initiativeGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return;
    
        // Récupère les personnages du groupe et les remet dans selectedCharacters
        const group = this.initiativeGroups[groupIndex];
        if (group.characters && group.characters.length) {
            this.selectedCharacters.push(...group.characters);
        }
    
        // Supprime le groupe
        this.initiativeGroups.splice(groupIndex, 1);
        this.render(true);
    }
    _onDeleteCharacter(event) {
        const characterId = event.currentTarget.dataset.characterId;
        this.selectedCharacters = this.selectedCharacters.filter(c => c.id !== characterId);
        this.render(true);
    }

    _onNameChange(event) {
        const {characterId, value} = event.currentTarget.dataset;
        const character = this.selectedCharacters.find(c => c.id === characterId);
        if (character) {
            character.name = value;
            this.render(true);
        }
    }

    _setupGroupDragDrop(html) {
        const dropZones = html.find('.group-dropzone').get();
        const draggables = html.find('.character-token').get();
        const self = this;
    
        dropZones.forEach(zone => {
            zone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
    
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
    
            zone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
            });
    
            zone.addEventListener('drop', async (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                
                const characterId = e.dataTransfer.getData('text/plain');
                const targetGroupId = zone.dataset.groupId;
                
                let character = self.selectedCharacters.find(c => c.id === characterId);
                let sourceGroupIndex = -1;
                
                if (!character) {
                    for (let i = 0; i < self.initiativeGroups.length; i++) {
                        const found = self.initiativeGroups[i].characters?.find(c => c.id === characterId);
                        if (found) {
                            character = found;
                            sourceGroupIndex = i;
                            break;
                        }
                    }
                }
            
                if (!character || !targetGroupId) return;
            
                if (sourceGroupIndex >= 0) {
                    self.initiativeGroups[sourceGroupIndex].characters = 
                        self.initiativeGroups[sourceGroupIndex].characters.filter(c => c.id !== characterId);
                } else {
                    self.selectedCharacters = self.selectedCharacters.filter(c => c.id !== characterId);
                }
            
                const targetGroup = self.initiativeGroups.find(g => g.id === targetGroupId);
                if (!targetGroup.characters) targetGroup.characters = [];
                targetGroup.characters.push(character);
            
                await self.updateState();
            });
        });
    
        draggables.forEach(draggable => {
            draggable.setAttribute('draggable', true);
            
            draggable.addEventListener('dragstart', (e) => {
                draggable.classList.add('dragging');
                e.dataTransfer.setData('text/plain', draggable.dataset.characterId);
            });
    
            draggable.addEventListener('dragend', () => {
                draggable.classList.remove('dragging');
                html.find('.group-dropzone').removeClass('dragover');
            });
        });
    }

    _setupDropIndicators(container) {
        // Nettoyer les indicateurs existants
        container.querySelectorAll('.drop-indicator').forEach(i => i.remove());
        
        // Créer un indicateur initial
        const addIndicator = (position) => {
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.dataset.position = position.toString();
            return indicator;
        };
    
        // Ajouter avant la première carte
        container.insertBefore(addIndicator(0), container.firstChild);
    
        // Ajouter entre chaque carte
        const cards = container.querySelectorAll('.initiative-card');
        cards.forEach((card, index) => {
            card.insertAdjacentElement('afterend', addIndicator(index + 1));
        });
    }
    // Initiative
    async _onDrawInitiative(event) {
        event.preventDefault();
    
        if (this.selectedCharacters.length > 0) {
            ui.notifications.error(`Cannot draw initiative: ${this.selectedCharacters.length} characters are still unassigned!`);
            return;
        }
    
        if (!this.initiativeGroups.some(group => group.characters?.length > 0)) {
            ui.notifications.error("Cannot draw initiative: No characters in any group!");
            return;
        }
    
        // Préparer toutes les données avant la mise à jour
        this.drawnInitiative = [];
        for (const group of this.initiativeGroups) {
            if (!group.characters?.length) continue;
    
            const validCharacters = await Promise.all(
                group.characters.map(async char => {
                    const actor = game.actors.get(char.actorId);
                    if (!actor) return null;
    
                    return {
                        id: char.id,
                        name: char.name || actor.name,
                        img: actor.img || "icons/svg/mystery-man.svg",
                        bio: actor.system.biography || "",
                        actorId: char.actorId,
                        expanded: false,
                        threats: 0,
                        isKO: false,
                        isActive: false
                    };
                })
            );
    
            const shuffledCharacters = this._shuffleArray(validCharacters.filter(c => c !== null));
            this.drawnInitiative.push(...shuffledCharacters);
        }
    
        if (this.drawnInitiative.length > 0) {
            const firstNonKO = this.drawnInitiative.find(char => !char.isKO);
            if (firstNonKO) {
                firstNonKO.isActive = true;
            }
        }
    
        ChatMessage.create({
            content: `<div class="initiative-announcement">
                        <h2>Action Started!</h2>
                        <h3>${this.drawnInitiative[0].name}'s turn!</h3>
                     </div>`,
            type: CONST.CHAT_MESSAGE_STYLES.OTHER,
            speaker: { alias: "Initiative Tracker" }
        });
    
        // Activer l'état et mettre à jour en une seule fois
        this.isInitiativeDrawn = true;
        await this.updateState();
    }


_onExpandCard(event) {
    const card = event.currentTarget.closest('.initiative-card');
    const cardId = card.dataset.cardId;
    const character = this.drawnInitiative.find(c => c.id === cardId);
    if (character) {
        character.expanded = !character.expanded;
        // Remplacer le render par updateState
        this.updateState(false); // false car on veut juste une mise à jour visuelle
    }
}

    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

// Dans la méthode _setupInitiativeCardDragDrop
_setupInitiativeCardDragDrop(html) {
    const container = html.find('.initiative-cards-container').get(0);
    if (!container) return;

    let draggedCard = null;
    let draggedElement = null;
    let dragImage = null;
    let startX, startY;

    const cards = container.querySelectorAll('.initiative-card');
    cards.forEach(card => {
        const handle = card.querySelector('.drag-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.card-controls')) return;
            e.preventDefault();
            
            draggedCard = card;
            draggedElement = this.drawnInitiative.find(c => c.id === card.dataset.cardId);
            startX = e.clientX;
            startY = e.clientY;

            // Créer une copie pour l'image de drag
            dragImage = card.cloneNode(true);
            dragImage.style.position = 'fixed';
            dragImage.style.zIndex = '10000';
            dragImage.style.pointerEvents = 'none';
            dragImage.style.width = `${card.offsetWidth}px`;
            dragImage.style.opacity = '0.7';
            document.body.appendChild(dragImage);

            // Style de la carte originale
            card.style.opacity = '0.3';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });

    const onMouseMove = (e) => {
        if (!draggedCard || !dragImage) return;

        dragImage.style.left = `${e.clientX - dragImage.offsetWidth / 2}px`;
        dragImage.style.top = `${e.clientY - dragImage.offsetHeight / 2}px`;

        const targetCard = findTargetCard(e.clientX, cards);
        resetCardStyles();

        if (targetCard) {
            const rect = targetCard.getBoundingClientRect();
            const isAfter = e.clientX > rect.left + rect.width / 2;
            
            if (isAfter) {
                targetCard.style.borderRight = '3px solid var(--color-border-highlight)';
            } else {
                targetCard.style.borderLeft = '3px solid var(--color-border-highlight)';
            }
        }
    };

    const findTargetCard = (x, cards) => {
        return Array.from(cards).find(card => {
            if (card === draggedCard) return false;
            const rect = card.getBoundingClientRect();
            return x >= rect.left && x <= rect.right;
        });
    };

    const resetCardStyles = () => {
        cards.forEach(card => {
            card.style.borderLeft = '';
            card.style.borderRight = '';
        });
    };

    const onMouseUp = async (e) => {
        if (!draggedCard) return;

        const targetCard = findTargetCard(e.clientX, cards);
        if (targetCard) {
            const targetIndex = Array.from(cards).indexOf(targetCard);
            const currentIndex = Array.from(cards).indexOf(draggedCard);
            const rect = targetCard.getBoundingClientRect();
            const isAfter = e.clientX > rect.left + rect.width / 2;

            if (currentIndex !== targetIndex) {
                const newIndex = isAfter ? targetIndex + 1 : targetIndex;
                const updatedOrder = [...this.drawnInitiative];
                const [movedCard] = updatedOrder.splice(currentIndex, 1);
                
                if (movedCard.isActive) {
                    movedCard.isActive = false;
                }
                
                updatedOrder.splice(newIndex, 0, movedCard);
                this.drawnInitiative = updatedOrder;
                await this.updateState();
            }
        }

        // Cleanup
        if (dragImage) {
            dragImage.remove();
            dragImage = null;
        }
        if (draggedCard) {
            draggedCard.style.opacity = '';
            draggedCard = null;
        }
        resetCardStyles();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
}
_getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.initiative-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async _verifyInitiativeOrder() {
    const firstCard = this.drawnInitiative[0];
    if (!firstCard) return;

    if (firstCard.isKO) {
        // Déplacer la carte KO à la fin sans message
        this.drawnInitiative = [
            ...this.drawnInitiative.slice(1),
            firstCard
        ];
        await this._verifyInitiativeOrder();
    } else if (!firstCard.isActive && !this.drawnInitiative.some(c => c.isActive)) {
        // Si aucune carte n'est active et que la première n'est pas KO
        firstCard.isActive = true;
    }

    this.updateState();
}
// N'oubliez pas d'ajouter dans close() :
close() {
    if (this.dragDropCleanup) {
        this.dragDropCleanup();
    }
    return super.close();
}


_updateCardOrder(draggedCard) {
        const container = draggedCard.parentNode;
        const ghost = container.querySelector('.card-gap');
        
        if (!ghost) return;
    
        const newIndex = Array.from(container.children).indexOf(ghost);
        const oldIndex = Array.from(container.children).indexOf(draggedCard);
        
        if (newIndex === oldIndex) return;
    
        const updatedOrder = [...this.drawnInitiative];
        const [movedCard] = updatedOrder.splice(oldIndex, 1);
        
        // Désactiver la carte si elle était active
        if (movedCard.isActive) {
            movedCard.isActive = false;
        }
        
        updatedOrder.splice(newIndex > oldIndex ? newIndex - 1 : newIndex, 0, movedCard);
        this.drawnInitiative = updatedOrder;
    
        this.updateState();
    }

_updateGhostPosition(mouseX, draggedCard) {
    const container = draggedCard.parentNode;
    const cards = [...container.querySelectorAll('.initiative-card:not(.dragging)')];
    const ghost = container.querySelector('.card-gap');
    
    if (!ghost) return;

    let targetIndex = cards.findIndex(card => {
        const rect = card.getBoundingClientRect();
        return mouseX < rect.left + (rect.width / 2);
    });

    if (targetIndex === -1) {
        container.appendChild(ghost);
    } else {
        container.insertBefore(ghost, cards[targetIndex]);
    }
}

// Nouveau bouton pour ajouter à l'initiative
_addQuickInitiativeButton(html) {
    const tokenControls = html.find('.token-controls');
    const quickInitButton = `
        <button class="quick-init" title="Add to Initiative">
            <i class="fas fa-plus-circle"></i>
        </button>
    `;
    
    tokenControls.each(function() {
        $(this).prepend(quickInitButton);
    });

    html.find('.quick-init').on('click', async (event) => {
        event.preventDefault();
        const characterId = event.currentTarget.closest('[data-character-id]').dataset.characterId;
        const character = this.selectedCharacters.find(c => c.id === characterId) || 
                         this.initiativeGroups.flatMap(g => g.characters)
                                            .find(c => c.id === characterId);

        if (character) {
            const actor = game.actors.get(character.actorId);
            if (actor) {
                const initiativeChar = {
                    id: foundry.utils.randomID(),
                    name: character.name,
                    img: actor.img || "icons/svg/mystery-man.svg",
                    bio: actor.system.biography || "",
                    actorId: character.actorId,
                    expanded: false,
                    threats: 0,
                    isKO: false
                };

                this.drawnInitiative.push(initiativeChar);
                this.isInitiativeDrawn = true;
                await  this.updateState();
            }
        }
    });
}

_updateCardOrder(draggedCard) {
    const container = draggedCard.parentNode;
    const ghost = container.querySelector('.card-gap');
    
    if (!ghost) return;

    const newIndex = Array.from(container.children).indexOf(ghost);
    const oldIndex = Array.from(container.children).indexOf(draggedCard);
    
    if (newIndex === oldIndex) return;

    const updatedOrder = [...this.drawnInitiative];
    const [movedCard] = updatedOrder.splice(oldIndex, 1);
    updatedOrder.splice(newIndex > oldIndex ? newIndex - 1 : newIndex, 0, movedCard);
    this.drawnInitiative = updatedOrder;

    this.updateState();
}



_onAddThreat(event) {
    const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
    const character = this.drawnInitiative.find(c => c.id === cardId);
    if (character) {
        character.threats = (character.threats || 0) + 1;
    }
    this.updateState();
}
    
_onRemoveThreat(event) {
    const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
    const character = this.drawnInitiative.find(c => c.id === cardId);
    if (character && character.threats > 0) {
        character.threats--;
    }
    this.updateState();
}
    
_onToggleKO(event) {
    const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
    const character = this.drawnInitiative.find(c => c.id === cardId);
    if (!character) return;

    const wasKO = character.isKO;
    character.isKO = !wasKO;

    // Si le personnage devient KO
    if (character.isKO) {
        // Désactiver si actif
        if (character.isActive) {
            character.isActive = false;
        }

        // Si c'est la première carte, la déplacer à la fin et traiter le tour suivant
        if (this.drawnInitiative[0].id === character.id) {
            this.drawnInitiative = [
                ...this.drawnInitiative.slice(1),
                character
            ];
            this._processNextTurn();
        }

        // Vérifier si tous les personnages sont KO
        if (this.drawnInitiative.every(char => char.isKO)) {
            if (this.alertsEnabled) {
                ChatMessage.create({
                    content: `<div class="initiative-turn-announcement"><h3>All characters are KO! End of Action.</h3></div>`,
                    type: CONST.CHAT_MESSAGE_STYLES.WARNING,
                    speaker: { alias: "Initiative Tracker" }
                });
            }
            this._onEndAction();
            return;
        }
    }

    this.updateState();
}


    _onDeleteCard(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        this.drawnInitiative = this.drawnInitiative.filter(c => c.id !== cardId);
        this.updateState();
    }

    //Opportunity system//
    _onAddOpportunity(event) {
        event.preventDefault();
        const newOpportunity = {
            id: foundry.utils.randomID(),
            name: `Opportunity ${this.opportunities.length + 1}`,
            points: 0
        };
        this.opportunities.push(newOpportunity);
        this.render(true);
    }

    _onClearOpportunities(event) {
        event.preventDefault();
        const d = new Dialog({
            title: "Clear All Opportunities",
            content: "<p>Are you sure you want to remove all opportunities?</p>",
            buttons: {
                yes: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Yes, clear all",
                    callback: () => {
                        this.opportunities = [];
                        this.render(true);
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "no"
        });
        d.render(true);
    }

    _onDeleteOpportunity(event) {
        const id = event.currentTarget.closest('.opportunity-card').dataset.id;
        this.opportunities = this.opportunities.filter(o => o.id !== id);
        this.render(true);
    }


    _onEditOpportunityName(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const card = event.currentTarget.closest('.opportunity-card');
        const id = card?.dataset.id;
        const newName = event.currentTarget.value.trim();
        
        if (id && newName) {
            const opportunity = this.opportunities.find(o => o.id === id);
            if (opportunity) {
                opportunity.name = newName;
                event.currentTarget.blur(); // Défocus le champ
                
                // Mise à jour immédiate
                this._renderOpportunities();
                
                // Mise à jour du display
                const displayApp = Object.values(ui.windows).find(w => w instanceof game.weaveOfEchoes.InitiativeDisplay);
                if (displayApp) {
                    displayApp.updateDisplay(null, this.opportunities);
                }
            }
        }
    }

    _incrementOpportunityPoints(event) {
        const id = event.currentTarget.closest('.opportunity-token').dataset.id;
        const opportunity = this.opportunities.find(o => o.id === id);
        if (opportunity) {
            opportunity.points++;
            this.render(true);
        }
    }

    _decrementOpportunityPoints(event) {
        const id = event.currentTarget.closest('.opportunity-token').dataset.id;
        const opportunity = this.opportunities.find(o => o.id === id);
        if (opportunity && opportunity.points > 0) {
            opportunity.points--;
            this.render(true);
        }
    }

    _setupOpportunityListeners(html) {
        // Création d'opportunité
        html.find('.create-opportunity').on('click', (ev) => {
            ev.preventDefault();
            const newOpportunity = {
                id: foundry.utils.randomID(),
                name: `Opportunity ${this.opportunities.length + 1}`,
                points: 0,
                creator: null
            };
            this.opportunities.push(newOpportunity);
            this._renderOpportunities();
        });
    
        // Gestion du nom
        html.find('.opportunity-name').on('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                ev.stopPropagation();
                ev.target.blur();
            }
        });
    
        html.find('.opportunity-name').on('change', (ev) => {
            ev.preventDefault();
            const card = ev.target.closest('.opportunity-card');
            if (!card) return;
            
            const id = card.dataset.id;
            const opportunity = this.opportunities.find(o => o.id === id);
            if (opportunity) {
                opportunity.name = ev.target.value.trim();
                // Pas de render complet, juste mise à jour du display
                Hooks.call('updateInitiativeTracker', {
                    opportunities: this.opportunities
                });
            }
        });
    
        // Gestion des points
        html.find('.opportunity-increment').on('click', (ev) => {
            ev.preventDefault();
            const id = ev.target.closest('.opportunity-card').dataset.id;
            const opportunity = this.opportunities.find(o => o.id === id);
            if (opportunity) {
                opportunity.points++;
                this._renderOpportunities();
            }
        });
    
        html.find('.opportunity-decrement').on('click', (ev) => {
            ev.preventDefault();
            const id = ev.target.closest('.opportunity-card').dataset.id;
            const opportunity = this.opportunities.find(o => o.id === id);
            if (opportunity && opportunity.points > 0) {
                opportunity.points--;
                this._renderOpportunities();
            }
        });
    
        // Créateur
        html.find('.select-creator').on('click', (ev) => {
            ev.preventDefault();
            const id = ev.target.closest('.opportunity-card').dataset.id;
            if (id) this._showCreatorSelectionDialog(id);
        });
    
        // Clear All
        html.find('.clear-opportunities').on('click', (ev) => {
            ev.preventDefault();
            if (this.opportunities.length > 0) {
                const d = new Dialog({
                    title: "Clear All Opportunities",
                    content: "<p>Are you sure you want to remove all opportunities?</p>",
                    buttons: {
                        yes: {
                            icon: '<i class="fas fa-trash"></i>',
                            label: "Yes",
                            callback: () => {
                                this.opportunities = [];
                                this._renderOpportunities();
                            }
                        },
                        no: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "No"
                        }
                    },
                    default: "no"
                });
                d.render(true);
            }
        });
    }
    
    _renderOpportunities() {
        const opportunitiesTab = this.element.find('.tab[data-tab="opportunities"]');
        const content = `
            <div class="opportunities-content">
                <div class="opportunities-header">
                    <button class="create-opportunity">
                        <i class="fas fa-plus"></i> Create Opportunity
                    </button>
                    <button class="clear-opportunities" ${!this.opportunities.length ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                </div>
                <div class="opportunities-container">
                    ${this.opportunities.map(opp => `
                        <div class="opportunity-card" data-id="${opp.id}">
                            <div class="opportunity-points-circle">
                                <span class="points-value">${opp.points}</span>
                            </div>
                            <div class="opportunity-content">
                                <input type="text" 
                                    class="opportunity-name" 
                                    value="${opp.name}"
                                    maxlength="${InitiativeTracker.MAX_OPPORTUNITY_NAME_LENGTH}"
                                />
                                <div class="opportunity-controls">
                                    <button class="opportunity-increment" title="Add Point">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                    <button class="opportunity-decrement" title="Remove Point">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <button class="delete-opportunity" title="Delete">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="opportunity-creator">
                                    ${opp.creator 
                                        ? `<span>Created by: ${opp.creator.name}</span>`
                                        : `<span class="no-creator">No Creator</span>`
                                    }
                                    <button class="select-creator" title="Select Creator">
                                        <i class="fas fa-user-edit"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        opportunitiesTab.html(content);
        this._setupOpportunityListeners(this.element);
    
        // Mise à jour du display
        Hooks.call('updateInitiativeTracker', {
            opportunities: this.opportunities
        });

        this.updateState(false);
    }
    
    async _showCreatorSelectionDialog(opportunityId) {
        const actors = game.actors.filter(a => a.type === "character" || a.type === "npc");
        const opportunity = this.opportunities.find(o => o.id === opportunityId);
        
        const content = `
            <div class="creator-selection-grid">
                ${actors.map(actor => `
                    <div class="creator-option" data-actor-id="${actor.id}">
                        <img src="${actor.img}" alt="${actor.name}">
                        <span class="creator-name">${actor.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    
        const dialog = new Dialog({
            title: "Select Opportunity Creator",
            content,
            buttons: {},
            render: (html) => {
                // Ajouter les listeners après le rendu
                html.find('.creator-option').on('click', async (ev) => {
                    const actorId = ev.currentTarget.dataset.actorId;
                    if (actorId) {
                        const creator = game.actors.get(actorId);
                        opportunity.creator = {
                            id: creator.id,
                            name: creator.name,
                            img: creator.img
                        };
                        await this._renderOpportunities();
                        dialog.close();
                    }
                });
            }
        }, {width: 400});
    
        dialog.render(true);
    }

    close(options={}) {
        // Nettoyer tous les écouteurs d'événements
        if (this.element) {
            const container = this.element.find('.initiative-cards-container').get(0);
            if (container) {
                container.querySelectorAll('.initiative-card').forEach(card => {
                    card.removeAttribute('draggable');
                    // Supprimer explicitement les écouteurs d'événements
                    ['dragstart', 'dragend', 'dragover', 'drop'].forEach(event => {
                        card.replaceWith(card.cloneNode(true));
                    });
                });
            }
        }
        
        return super.close(options);
    }

}