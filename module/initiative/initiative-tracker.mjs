export class InitiativeTracker extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'initiative-tracker',
            template: 'systems/weave_of_echoes/templates/initiative/initiative-tracker.hbs',
            title: 'Initiative Tracker',
            width: 720,
            height: 800,
            resizable: true,
            classes: ['initiative-tracker-window']
        });
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
    }

    getData(options = {}) {
        const data = super.getData(options);
        
        return {
            initiativeGroups: this.initiativeGroups,
            selectedCharacters: this.selectedCharacters,
            drawnInitiative: this.drawnInitiative,  // Plus de mapping ici
            isInitiativeDrawn: this.isInitiativeDrawn,
            setupCollapsed: this.setupCollapsed,
            initiativeCollapsed: this.initiativeCollapsed,
            alertsEnabled: this.alertsEnabled
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
    
        html.on('click', '.add-characters', this._onAddCharacters.bind(this));
        html.on('click', '.add-group', this._onAddGroup.bind(this));
        html.on('click', '.draw-initiative', this._onDrawInitiative.bind(this));
        html.on('click', '.delete-char', this._onDeleteCharacter.bind(this));
        html.on('click', '.duplicate-char', this._onDuplicateCharacter.bind(this));
        html.on('click', '.delete-group', this._onDeleteGroup.bind(this));
        html.on('change', '.character-name-input', this._onNameChange.bind(this));
        html.on('click', '.toggle-setup', this._onToggleSetup.bind(this));
        html.on('click', '.toggle-initiative', this._onToggleInitiative.bind(this));
        html.on('click', '.expand-button', this._onExpandCard.bind(this));
        html.on('click', '.threat-button', this._onAddThreat.bind(this));
        html.on('click', '.threat-counter', this._onRemoveThreat.bind(this));
        html.on('click', '.ko-button', this._onToggleKO.bind(this));
        html.on('click', '.delete-card', this._onDeleteCard.bind(this));
        html.on('click', '.end-turn-button', this._onEndTurn.bind(this));
        html.on('change', '.toggle-active', this._onToggleActive.bind(this));
        html.on('click', '.end-action-button', this._onEndAction.bind(this));
        html.on('click', '.toggle-alerts', () => this._toggleAlerts());
    
        // Setup drag & drop uniquement si nécessaire
        this._setupGroupDragDrop(html);
        if (this.isInitiativeDrawn) {
            this._setupInitiativeCardDragDrop(html);
        }

        if (this.isInitiativeDrawn) {
            this._addQuickInitiativeButton(html);
        }
    }

    async updateState(shouldRender = true) {
        // Si une mise à jour est déjà en cours, ne pas en démarrer une autre
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            // Appeler le hook une seule fois
            await Hooks.callAll('updateInitiativeTracker', {
                drawnInitiative: this.drawnInitiative,
                isInitiativeDrawn: this.isInitiativeDrawn
            });
        
            // Render seulement si shouldRender est true
            if (shouldRender) {
                await this.render(true);
            }
        } finally {
            this.isUpdating = false;
        }
    }
    
    _onEndTurn(event, isAutoPass = false) {
        if (event) event.preventDefault();
        if (!this.drawnInitiative.length) return;
    
        // Trouver toutes les cartes actives
        const activeCards = this.drawnInitiative.filter(char => char.isActive);
        if (activeCards.length === 0) return;
    
        // Retirer toutes les cartes actives de l'ordre actuel
        this.drawnInitiative = this.drawnInitiative.filter(char => !char.isActive);
    
        // Désactiver les cartes et les ajouter à la fin
        activeCards.forEach(card => {
            card.isActive = false;
            this.drawnInitiative.push(card);
        });
    
        // Trouver le prochain personnage non-KO
        let nextActiveFound = false;
        let i = 0;
        
        while (i < this.drawnInitiative.length && !nextActiveFound) {
            const char = this.drawnInitiative[i];
            
            if (char.isKO) {
                // Si le personnage est KO, on l'envoie à la fin et on continue
                if (this.alertsEnabled) {
                    ChatMessage.create({
                        content: `<div class="initiative-announcement"><h3>${char.name} is KO and skips their turn!</h3></div>`,
                        type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                        speaker: { alias: "Initiative Tracker" }
                    });
                }
                
                // Retirer le personnage KO et le mettre à la fin
                const [koChar] = this.drawnInitiative.splice(i, 1);
                this.drawnInitiative.push(koChar);
                
                // Ne pas incrémenter i car nous avons un nouveau personnage à cette position
                continue;
            }
            
            // Si on trouve un personnage non-KO, on l'active
            char.isActive = true;
            nextActiveFound = true;
            
            // Annoncer le nouveau tour
            if (!isAutoPass && this.alertsEnabled) {
                this._announceNewTurn();
            }
            
            i++;
        }
    
        // Si aucun personnage actif n'est trouvé et les alertes sont activées
        if (!nextActiveFound && this.alertsEnabled) {
            ChatMessage.create({
                content: `<div class="initiative-announcement"><h3>All characters are KO!</h3></div>`,
                type: CONST.CHAT_MESSAGE_STYLES.WARNING,
                speaker: { alias: "Initiative Tracker" }
            });
        }
    
        this.updateState();
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
        this.selectedCharacters.push(...newCharacters);
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
        const draggables = html.find('.character-token').get();
        const dropZones = html.find('.group-dropzone').get();
        const self = this;
    
        draggables.forEach(draggable => {
            draggable.setAttribute('draggable', true);
            
            draggable.addEventListener('dragstart', function(e) {
                draggable.classList.add('dragging');
                e.dataTransfer.setData('text/plain', this.dataset.characterId);
            });
    
            draggable.addEventListener('dragend', function() {
                draggable.classList.remove('dragging');
                html.find('.group-dropzone').removeClass('dragover');
            });
        });
    
        dropZones.forEach(dropZone => {
            dropZone.addEventListener('drop', async function(e) {
                e.preventDefault();
                this.classList.remove('dragover');
                
                const characterId = e.dataTransfer.getData('text/plain');
                const targetGroupId = this.dataset.groupId;
                
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
            
                // Remplacer le render par updateState
                await self.updateState();
            });
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

    let isDragging = false;
    let draggedCard = null;
    let dragImage = null;
    let originalIndex = -1;

    // Fonction pour positionner les séparateurs
    const setupSeparators = () => {
        // Nettoyer les séparateurs existants
        container.querySelectorAll('.card-separator').forEach(sep => sep.remove());
        
        const cards = [...container.querySelectorAll('.initiative-card')];
        
        // Créer les séparateurs entre les cartes
        cards.forEach((card, index) => {
            const separator = document.createElement('div');
            separator.className = 'card-separator';
            separator.dataset.index = index;
            container.appendChild(separator);

            // Positionner le séparateur au centre
            if (index < cards.length) {
                const currentRect = card.getBoundingClientRect();
                const nextCard = cards[index + 1];
                
                if (nextCard) {
                    const nextRect = nextCard.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const center = (currentRect.right + nextRect.left) / 2;
                    separator.style.left = `${center - containerRect.left}px`;
                }
            }
        });

        // Ajouter le séparateur final
        if (cards.length > 0) {
            const lastCard = cards[cards.length - 1];
            const finalSeparator = document.createElement('div');
            finalSeparator.className = 'card-separator';
            finalSeparator.dataset.index = cards.length;
            container.appendChild(finalSeparator);

            const lastRect = lastCard.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            finalSeparator.style.left = `${(lastRect.right - containerRect.left) + 15}px`;
        }
    };

    // Fonction pour mettre à jour les séparateurs actifs
    const updateActiveSeparator = (mouseX) => {
        const separators = container.querySelectorAll('.card-separator');
        let activeFound = false;

        separators.forEach(separator => {
            const rect = separator.getBoundingClientRect();
            const hitZone = 15;

            if (!activeFound && Math.abs(mouseX - rect.left) < hitZone) {
                separator.classList.add('active');
                activeFound = true;
            } else {
                separator.classList.remove('active');
            }
        });
    };

    // Configuration du drag pour chaque carte
    const setupDrag = (card) => {
        const dragHandle = card.querySelector('.drag-handle');
        if (!dragHandle) return;

        dragHandle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.card-controls') || this.isUpdating) return;
            e.preventDefault();

            isDragging = true;
            draggedCard = card;
            originalIndex = Array.from(container.children)
                .filter(el => el.classList.contains('initiative-card'))
                .indexOf(card);

            // Créer l'image de drag
            dragImage = card.cloneNode(true);
            dragImage.classList.add('dragging');
            dragImage.style.position = 'fixed';
            dragImage.style.width = `${card.offsetWidth}px`;
            dragImage.style.pointerEvents = 'none';
            dragImage.style.opacity = '0.7';
            document.body.appendChild(dragImage);

            card.style.opacity = '0.3';

            // Positionner l'image initiale
            dragImage.style.left = `${e.clientX - (dragImage.offsetWidth / 2)}px`;
            dragImage.style.top = `${e.clientY - (dragImage.offsetHeight / 2)}px`;
        });
    };

    const onMouseMove = (e) => {
        if (!isDragging || !dragImage) return;

        // Mettre à jour la position de l'image de drag
        dragImage.style.left = `${e.clientX - (dragImage.offsetWidth / 2)}px`;
        dragImage.style.top = `${e.clientY - (dragImage.offsetHeight / 2)}px`;

        // Mettre à jour le séparateur actif
        updateActiveSeparator(e.clientX);
    };

    const onMouseUp = async () => {
        if (!isDragging) return;

        const activeSeparator = container.querySelector('.card-separator.active');
        if (activeSeparator) {
            const newIndex = parseInt(activeSeparator.dataset.index);
            
            if (newIndex !== originalIndex) {
                const updatedOrder = [...this.drawnInitiative];
                const [movedCard] = updatedOrder.splice(originalIndex, 1);
                
                // Désactiver la carte si elle était active
                if (movedCard.isActive) {
                    movedCard.isActive = false;
                }
                
                updatedOrder.splice(newIndex, 0, movedCard);
                this.drawnInitiative = updatedOrder;

                await this.updateState();
            }
        }

        // Nettoyage
        if (dragImage) {
            dragImage.remove();
            dragImage = null;
        }
        if (draggedCard) {
            draggedCard.style.opacity = '';
            draggedCard = null;
        }
        isDragging = false;
        originalIndex = -1;

        // Nettoyer les séparateurs actifs
        container.querySelectorAll('.card-separator').forEach(sep => sep.classList.remove('active'));
    };

    // Setup initial
    setupSeparators();
    container.querySelectorAll('.initiative-card').forEach(setupDrag);

    // Event listeners globaux
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Gestion du redimensionnement
    window.addEventListener('resize', setupSeparators);

    // Cleanup when the app closes
    this.dragDropCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('resize', setupSeparators);
    };
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
    
        character.isKO = !character.isKO;
        character.isActive = false;
    
        // Vérifier combien de personnages non-KO il reste
        const remainingActive = this.drawnInitiative.filter(char => !char.isKO).length;
        
        if (remainingActive === 0) {
            // Tous les personnages sont KO, vider le tracker et mettre à jour l'affichage
            setTimeout(() => {
                ChatMessage.create({
                    content: `<div class="initiative-announcement">
                                <h2>All characters are KO!</h2>
                                <h3>Action Ends</h3>
                             </div>`,
                    type: CONST.CHAT_MESSAGE_STYLES.WARNING,
                    speaker: { alias: "Initiative Tracker" }
                });
    
                setTimeout(() => {
                    // Vider le tracker et notifier
                    this.drawnInitiative = [];
                    this.isInitiativeDrawn = false;
    
                    // Mettre à jour le display
                    this.updateState();
                }, 500);
            }, 500);
            return;
        } else if (this.drawnInitiative[0].id === character.id && character.isKO) {
            // Si le personnage actif devient KO, passer au suivant
            ChatMessage.create({
                content: `<div class="initiative-announcement">
                            <h3>${character.name} is KO and skips their turn!</h3>
                         </div>`,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                speaker: { alias: "Initiative Tracker" }
            });
            
            setTimeout(() => {
                this._onEndTurn(null, true);
            }, 500);
        }
    
        // Rendre et notifier pour tous les autres cas
        this.updateState();
    }
    
    
    _onDeleteCard(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        this.drawnInitiative = this.drawnInitiative.filter(c => c.id !== cardId);
        this.updateState();
    }
}