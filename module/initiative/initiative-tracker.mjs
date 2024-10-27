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
    }

    getData(options = {}) {
        const data = super.getData(options);
    
    // Ajoutez l'indicateur actif au premier personnage
    if (this.drawnInitiative.length > 0) {
        this.drawnInitiative[0].isActive = true;
    }
        return {
            initiativeGroups: this.initiativeGroups,
            selectedCharacters: this.selectedCharacters,
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn,
            setupCollapsed: this.setupCollapsed,
            initiativeCollapsed: this.initiativeCollapsed
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
    
        // Setup drag & drop uniquement si nécessaire
        this._setupGroupDragDrop(html);
        if (this.isInitiativeDrawn) {
            this._setupInitiativeCardDragDrop(html);
        }

        if (this.isInitiativeDrawn) {
            this._addQuickInitiativeButton(html);
        }
    }

    _onEndTurn(event, isAutoPass = false) {
        if (event) event.preventDefault();
        if (!this.drawnInitiative.length) return;
    
        // Déplacer le premier personnage à la fin
        const [currentTurn] = this.drawnInitiative.splice(0, 1);
        currentTurn.isActive = false;
        this.drawnInitiative.push(currentTurn);
    
        // Trouver le prochain personnage non-KO
        let nextActiveFound = false;
        for (let i = 0; i < this.drawnInitiative.length; i++) {
            const char = this.drawnInitiative[i];
            if (!char.isKO) {
                char.isActive = true;
                nextActiveFound = true;
                
                // Annoncer le nouveau tour seulement si ce n'est pas un auto-pass
                if (!isAutoPass) {
                    this._announceNewTurn();
                }
                break;
            } else if (i === 0) {
                // Si le prochain personnage est KO, l'annoncer et continuer
                ChatMessage.create({
                    content: `<div class="initiative-announcement"><h3>${char.name} is KO and skips their turn!</h3></div>`,
                    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                    speaker: { alias: "Initiative Tracker" }
                });
                
                // Appeler récursivement pour le prochain personnage
                setTimeout(() => {
                    this._onEndTurn(null, true);
                }, 100);
                return;
            }
        }
    
        // Si aucun personnage actif n'est trouvé
        if (!nextActiveFound) {
            ChatMessage.create({
                content: `<div class="initiative-announcement"><h3>All characters are KO!</h3></div>`,
                type: CONST.CHAT_MESSAGE_STYLES.WARNING,
                speaker: { alias: "Initiative Tracker" }
            });
        }
    
        this.render(true);

        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
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
        this.render(true);

        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
    }
    
    
    _announceNewTurn() {
        if (!this.drawnInitiative.length) return;
    
        const currentActor = this.drawnInitiative[0];
        if (!currentActor) return;
    
        // Message global dans le chat uniquement
        ChatMessage.create({
            content: `<div class="initiative-announcement"><h3>${currentActor.name}'s Turn</h3></div>`,
            type: CONST.CHAT_MESSAGE_STYLES.OTHER,
            speaker: { alias: "Initiative Tracker" }
        });
    }

    _onToggleActive(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        const character = this.drawnInitiative.find(c => c.id === cardId);
        if (character) {
            character.isActive = !character.isActive;
            this.render(false);
        }
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
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
                <div class="dialog-controls">
                    <button type="button" data-action="select-all">
                        <i class="fas fa-users"></i> Select All
                    </button>
                    <button type="button" data-action="confirm">
                        <i class="fas fa-check"></i> Confirm
                    </button>
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
            dropZone.addEventListener('dragenter', function(e) {
                e.preventDefault();
                this.classList.add('dragover');
            });
    
            dropZone.addEventListener('dragover', function(e) {
                e.preventDefault();
            });
    
            dropZone.addEventListener('dragleave', function(e) {
                if (!this.contains(e.relatedTarget)) {
                    this.classList.remove('dragover');
                }
            });
    
            dropZone.addEventListener('drop', async function(e) {
                e.preventDefault();
                this.classList.remove('dragover');
                
                const characterId = e.dataTransfer.getData('text/plain');
                const targetGroupId = this.dataset.groupId;
                
                // Trouve le personnage soit dans selectedCharacters soit dans un groupe
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
    
                // Retire le personnage de sa source actuelle
                if (sourceGroupIndex >= 0) {
                    self.initiativeGroups[sourceGroupIndex].characters = 
                        self.initiativeGroups[sourceGroupIndex].characters.filter(c => c.id !== characterId);
                } else {
                    self.selectedCharacters = self.selectedCharacters.filter(c => c.id !== characterId);
                }
    
                // Ajoute le personnage au groupe cible
                const targetGroup = self.initiativeGroups.find(g => g.id === targetGroupId);
                if (!targetGroup.characters) targetGroup.characters = [];
                targetGroup.characters.push(character);
    
                await self.render(true);
            });
        });
    }
    // Initiative
    async _onDrawInitiative(event) {
        event.preventDefault();
        console.log("Draw Initiative button clicked");
    
        if (this.selectedCharacters.length > 0) {
            ui.notifications.error(`Cannot draw initiative: ${this.selectedCharacters.length} characters are still unassigned!`);
            return;
        }
    
        if (!this.initiativeGroups.some(group => group.characters?.length > 0)) {
            ui.notifications.error("Cannot draw initiative: No characters in any group!");
            return;
        }
    
        this.isInitiativeDrawn = true;
        this.drawnInitiative = [];
    
        console.log("Initiative drawn for characters in groups:", this.initiativeGroups);
    
        // Continuer avec le traitement des groupes
        for (const group of this.initiativeGroups) {
            if (!group.characters?.length) continue;
    
            const validCharacters = await Promise.all(
                group.characters.map(async char => {
                    const actor = game.actors.get(char.actorId);
                    if (!actor) return null;
    
                    return {
                        id: char.id,
                        name: char.name || actor.name,
                        img: actor.img && actor.img !== "" ? actor.img : "icons/svg/mystery-man.svg",
                        bio: actor.system.biography || "",
                        actorId: char.actorId,
                        expanded: false,
                        threats: 0,
                        isKO: false
                    };
                })
            );
    
            const shuffledCharacters = this._shuffleArray(validCharacters.filter(c => c !== null));
            this.drawnInitiative.push(...shuffledCharacters);
        }
    
        // Vérifiez le contenu de drawnInitiative
        console.log("Final drawnInitiative:", this.drawnInitiative);
    
        if (this.drawnInitiative.length > 0) {
            this.drawnInitiative[0].isActive = true;
        }
    
        await this.render(true);
    
        ChatMessage.create({
            content: `<div class="initiative-announcement">
                        <h2>Action Started!</h2>
                        <h3>${this.drawnInitiative[0].name}'s turn!</h3>
                     </div>`,
            type: CONST.CHAT_MESSAGE_STYLES.OTHER,
            speaker: { alias: "Initiative Tracker" }
        });
    
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
    }
    


    _onExpandCard(event) {
        const card = event.currentTarget.closest('.initiative-card');
        const cardId = card.dataset.cardId;
        const character = this.drawnInitiative.find(c => c.id === cardId);
        if (character) {
            character.expanded = !character.expanded;
            this.render(false);
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

    // Fonction pour positionner correctement tous les séparateurs
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

            // Positionner le séparateur au centre entre les cartes
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
        const lastCard = cards[cards.length - 1];
        if (lastCard) {
            const finalSeparator = document.createElement('div');
            finalSeparator.className = 'card-separator';
            finalSeparator.dataset.index = cards.length;
            container.appendChild(finalSeparator);

            const lastRect = lastCard.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            finalSeparator.style.left = `${(lastRect.right - containerRect.left) + 15}px`;
        }
    };

    // Setup initial des séparateurs
    setupSeparators();

    // Configurer le drag & drop pour chaque carte
    const cards = container.querySelectorAll('.initiative-card');
    cards.forEach(card => {
        const dragHandle = card.querySelector('.drag-handle');
        if (!dragHandle) return;

        let isDragging = false;
        let dragCard = null;

        const startDragging = (e) => {
            if (e.target.closest('.card-controls')) return;
            
            isDragging = true;
            dragCard = card.cloneNode(true);
            dragCard.classList.add('dragging');
            dragCard.style.width = `${card.offsetWidth}px`;
            dragCard.style.position = 'fixed';
            dragCard.style.pointerEvents = 'none';
            
            document.body.appendChild(dragCard);
            card.style.opacity = '0.2';

            updateDragPosition(e);
            console.log('Drag started on card:', card.dataset.cardId);
        };

        const updateDragPosition = (e) => {
            if (!dragCard) return;
            dragCard.style.left = `${e.clientX - (dragCard.offsetWidth / 2)}px`;
            dragCard.style.top = `${e.clientY - (dragCard.offsetHeight / 2)}px`;
        };

        const updateSeparators = (mouseX) => {
            const separators = container.querySelectorAll('.card-separator');
            let activeFound = false;

            separators.forEach(separator => {
                const rect = separator.getBoundingClientRect();
                const hitZone = 15; // Zone de détection plus large

                if (!activeFound && Math.abs(mouseX - rect.left) < hitZone) {
                    separator.classList.add('active');
                    activeFound = true;
                } else {
                    separator.classList.remove('active');
                }
            });
        };

        const drag = (e) => {
            if (!isDragging || !dragCard) return;
            updateDragPosition(e);
            updateSeparators(e.clientX);
        };

        const stopDragging = (e) => {
            if (!isDragging || !dragCard) return;
        
            const activeSeparator = container.querySelector('.card-separator.active');
            if (activeSeparator) {
                const newIndex = parseInt(activeSeparator.dataset.index);
                const currentIndex = Array.from(container.children)
                    .filter(el => el.classList.contains('initiative-card'))
                    .indexOf(card);
        
                console.log('Current index:', currentIndex, 'New index:', newIndex);
        
                if (newIndex !== currentIndex) {
                    const updatedOrder = [...this.drawnInitiative];
                    const [movedCard] = updatedOrder.splice(currentIndex, 1);
                    updatedOrder.splice(newIndex, 0, movedCard);
        
                    this.drawnInitiative = updatedOrder;
                    this.render(true);
        
                    // Appeler le hook pour notifier les autres composants
                    Hooks.callAll('updateInitiativeTracker', {
                        drawnInitiative: this.drawnInitiative,
                        isInitiativeDrawn: this.isInitiativeDrawn
                    });
                }
            }
        
            isDragging = false;
            dragCard.remove();
            dragCard = null;
            card.style.opacity = '';
            container.querySelectorAll('.card-separator').forEach(sep => sep.classList.remove('active'));
        };

        dragHandle.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDragging);
    });

    // Rafraîchir les séparateurs lors du redimensionnement
    window.addEventListener('resize', setupSeparators);
}


_updateCardOrder(draggedCard, mouseX) {
    const container = draggedCard.parentNode;
    const cards = [...container.querySelectorAll('.initiative-card')];
    const targetIndex = cards.findIndex(card => {
        const rect = card.getBoundingClientRect();
        return mouseX < rect.left + rect.width / 2;
    });

    if (targetIndex === -1 || targetIndex === cards.indexOf(draggedCard)) return;

    // Mettre à jour l'ordre dans drawnInitiative
    const draggedIndex = cards.indexOf(draggedCard);
    const [movedCard] = this.drawnInitiative.splice(draggedIndex, 1);
    this.drawnInitiative.splice(targetIndex, 0, movedCard);

    this.drawnInitiative.forEach((char, index) => {
        // Un personnage KO ne peut pas être actif
        if (char.isKO) {
            char.isActive = false;
        }
        // Si aucun personnage n'est actif, activer le premier non-KO
        if (index === 0 && !this.drawnInitiative.some(c => c.isActive)) {
            char.isActive = !char.isKO;
        }
    });


    this.render(true);
    Hooks.callAll('updateInitiativeTracker', {
        drawnInitiative: this.drawnInitiative,
        isInitiativeDrawn: this.isInitiativeDrawn
    });
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
                await this.render(true);
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

    this.render(true);
    Hooks.callAll('updateInitiativeTracker', {
        drawnInitiative: this.drawnInitiative,
        isInitiativeDrawn: this.isInitiativeDrawn
    });
}



    _onAddThreat(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        const character = this.drawnInitiative.find(c => c.id === cardId);
        if (character) {
            character.threats = (character.threats || 0) + 1;
            this.render(false);
        }
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
    }
    
    _onRemoveThreat(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        const character = this.drawnInitiative.find(c => c.id === cardId);
        if (character && character.threats > 0) {
            character.threats--;
            this.render(false);
        }
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
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
                    this.render(true);
    
                    // Mettre à jour le display
                    Hooks.callAll('updateInitiativeTracker', {
                        drawnInitiative: this.drawnInitiative,
                        isInitiativeDrawn: this.isInitiativeDrawn
                    });
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
        this.render(true);
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
    }
    
    
    _onDeleteCard(event) {
        const cardId = event.currentTarget.closest('.initiative-card').dataset.cardId;
        this.drawnInitiative = this.drawnInitiative.filter(c => c.id !== cardId);
        this.render(true);
        Hooks.callAll('updateInitiativeTracker', {
            drawnInitiative: this.drawnInitiative,
            isInitiativeDrawn: this.isInitiativeDrawn
        });
    }
}