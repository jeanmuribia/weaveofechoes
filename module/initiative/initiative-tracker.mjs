export class InitiativeTracker extends Application {
    static get defaultOptions() {
        const options = super.defaultOptions;
        
        return foundry.utils.mergeObject(options, {
            id: 'initiative-tracker',
            template: 'systems/weave_of_echoes/templates/initiative/initiative-tracker.hbs',
            title: 'Initiative Tracker',
            width: 720,
            height: 800,
            resizable: true,
            classes: ['initiative-tracker-window'],
            // Utilisez le chemin relatif ici
            stylesheets: ['systems/weave_of_echoes/css/initiative-tracker.css']
        });
    }

    constructor() {
        super();
        this.initiativeGroups = [];
        this.selectedCharacters = [];
    
        // Lier les méthodes de drag & drop au contexte de la classe
        this._onDragStart = this._onDragStart.bind(this);
        this._onDragEnter = this._onDragEnter.bind(this);
        this._onDragLeave = this._onDragLeave.bind(this);
        this._onDrop = this._onDrop.bind(this);
    }
    
    activateListeners(html) {
        super.activateListeners(html);
    
        // Boutons principaux
        html.on('click', '.add-characters', this._onAddCharacters.bind(this));
        html.on('click', '.delete-char', this._onDeleteCharacter.bind(this));
        html.on('click', '.add-group', this._onAddGroup.bind(this));
        html.on('click', '.delete-group', this._onDeleteGroup.bind(this));
        html.on('click', '.duplicate-char', this._onDuplicateCharacter.bind(this));
        html.on('change', '.character-name-input', this._onNameChange.bind(this));
    
        // Setup drag & drop manuellement
        const draggables = html.find('.character-token');
        const dropZones = html.find('.group-dropzone');
    
        draggables.each((i, el) => {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', this._onDragStart);
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                dropZones.removeClass('dragover');
            });
        });
    
        dropZones.each((i, el) => {
            el.addEventListener('dragenter', this._onDragEnter);
            el.addEventListener('dragover', (e) => e.preventDefault());
            el.addEventListener('dragleave', this._onDragLeave);
            el.addEventListener('drop', this._onDrop);
        });
    }

    getData(options = {}) {
        return {
            initiativeGroups: this.initiativeGroups,
            selectedCharacters: this.selectedCharacters
        };
    }

    _onAddCharacters(event) {
        event.preventDefault();
        
        const dialog = new Dialog({
            title: "Select Characters",
            content: this._createCharacterSelectionContent(),
            buttons: {},
            render: html => this._activateCharacterSelectionListeners(html),
            default: "confirm"
        }, {
            width: 400,
            classes: ['character-select-dialog']
        });

        dialog.render(true);
    }

    _onDeleteCharacter(event) {
        const characterId = event.currentTarget.dataset.characterId;
        this.selectedCharacters = this.selectedCharacters.filter(c => c.id !== characterId);
        this.render(true);
      }

      _onNameChange(event) {
        const input = event.currentTarget;
        const characterId = input.dataset.characterId;
        const newName = input.value;
    
        // Rechercher et mettre à jour le nom dans selectedCharacters
        const character = this.selectedCharacters.find(c => c.id === characterId);
        if (character) {
            character.name = newName;
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
            dialog.close();
        });
    }

    async _processSelectedActors(actorIds) {
        const newCharacters = actorIds.map(id => {
            const actor = game.actors.get(id);
            return {
                id: foundry.utils.randomID(),
                actorId: actor.id,
                name: actor.name
            };
        });

        if (!Array.isArray(this.selectedCharacters)) {
            this.selectedCharacters = [];
        }

        this.selectedCharacters.push(...newCharacters);
    }

    _onAddGroup(event) {
        event.preventDefault();
        this.initiativeGroups.push({
            id: foundry.utils.randomID(),
            name: `Group ${this.initiativeGroups.length + 1}`,
            characters: []
        });
        this.render(true);
    }

    _onDeleteGroup(event) {
        const groupContainer = event.currentTarget.closest('.group-container');
        const groupId = groupContainer?.dataset.groupId;
        
        if (!groupId) return;

        const group = this.initiativeGroups.find(g => g.id === groupId);
        if (group && group.characters?.length) {
            this.selectedCharacters.push(...group.characters);
        }

        this.initiativeGroups = this.initiativeGroups.filter(g => g.id !== groupId);
        this.render(true);
    }

    _onDuplicateCharacter(event) {
        event.preventDefault();
        event.stopPropagation();
    
        const button = event.currentTarget;
        const characterId = button.dataset.characterId;
        const groupContainer = button.closest('.group-container');
        const groupId = groupContainer?.dataset.groupId;
    
        let characterToDuplicate;
        let targetArray;
    
        if (groupId) {
            const group = this.initiativeGroups.find(g => g.id === groupId);
            characterToDuplicate = group?.characters.find(c => c.id === characterId);
            targetArray = group?.characters;
        } else {
            characterToDuplicate = this.selectedCharacters.find(c => c.id === characterId);
            targetArray = this.selectedCharacters;
        }
    
        if (characterToDuplicate && targetArray) {
            const duplicate = {
                ...characterToDuplicate,
                id: foundry.utils.randomID(),
                name: `${characterToDuplicate.name} (${characterToDuplicate.duplicateCount || 1})`  // Ajouter le compteur
            };
            targetArray.push(duplicate);
    
            // Incrémenter le compteur de duplicata
            if (!characterToDuplicate.duplicateCount) {
                characterToDuplicate.duplicateCount = 1;
            }
            characterToDuplicate.duplicateCount += 1;
    
            this.render(true);
        }
    }
    

    // Drag & Drop Methods
    _onDragStart(event) {
        const token = event.target.closest('.character-token');
        if (!token) return;

        token.classList.add('dragging');
        event.dataTransfer.setData('text/plain', token.dataset.characterId);
    }

    _onDragEnter(event) {
        event.preventDefault();
        const dropZone = event.target.closest('.group-dropzone');
        if (dropZone) {
            dropZone.classList.add('dragover');
        }
    }

    _onDragLeave(event) {
        event.preventDefault();
        const dropZone = event.target.closest('.group-dropzone');
        if (dropZone && !dropZone.contains(event.relatedTarget)) {
            dropZone.classList.remove('dragover');
        }
    }

    async _onDrop(event) {
        event.preventDefault();
        
        const dropZone = event.target.closest('.group-dropzone');
        if (!dropZone) return;

        dropZone.classList.remove('dragover');
        const characterId = event.dataTransfer.getData('text/plain');
        const targetGroupId = dropZone.dataset.groupId;

        if (!characterId || !targetGroupId) return;

        // Find character and its current location
        let character;
        let sourceGroup;

        // Check in unassigned characters first
        character = this.selectedCharacters.find(c => c.id === characterId);
        
        if (character) {
            // Remove from unassigned
            this.selectedCharacters = this.selectedCharacters.filter(c => c.id !== characterId);
        } else {
            // Check in groups
            for (const group of this.initiativeGroups) {
                const found = group.characters.find(c => c.id === characterId);
                if (found) {
                    character = found;
                    sourceGroup = group;
                    break;
                }
            }
            
            if (sourceGroup) {
                sourceGroup.characters = sourceGroup.characters.filter(c => c.id !== characterId);
            }
        }

        if (character) {
            // Add to target group
            const targetGroup = this.initiativeGroups.find(g => g.id === targetGroupId);
            if (targetGroup) {
                if (!Array.isArray(targetGroup.characters)) {
                    targetGroup.characters = [];
                }
                targetGroup.characters.push(character);
            }
        }

        // Rafraîchir l'affichage
        this.render(true);
    }

    _setupDragDrop(html) {
        const draggables = html.find('.character-token').toArray();
        const dropZones = html.find('.group-dropzone').toArray();

        draggables.forEach(draggable => {
            draggable.setAttribute('draggable', true);

            draggable.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                draggable.classList.add('dragging');
                e.dataTransfer.setData('text/plain', draggable.dataset.characterId);
                draggable.style.opacity = '0.5';
            });

            draggable.addEventListener('dragend', (e) => {
                draggable.classList.remove('dragging');
                draggable.style.opacity = '';
                dropZones.forEach(zone => zone.classList.remove('dragover'));
            });
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            zone.addEventListener('dragleave', (e) => {
                if (e.target === zone && !zone.contains(e.relatedTarget)) {
                    zone.classList.remove('dragover');
                }
            });
        });
    }
}