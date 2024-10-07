export class SynergyTracker extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "synergy-tracker",
            template: "systems/weave_of_echoes/templates/synergy-tracker.hbs",
            title: "Synergy Tracker",
            width: 300,
            height: "auto",
            minimizable: true,
            resizable: false,
            draggable: true
        });
    }

    getData() {
        let synergyData = game.settings.get("weave_of_echoes", "synergyData");
        if (!synergyData) {
            synergyData = {
                currentSynergy: 0,
                maxSynergy: 0,
                characters: []
            };
            game.settings.set("weave_of_echoes", "synergyData", synergyData);
        }
        return synergyData;
    }
    

    activateListeners(html) {
        super.activateListeners(html);
    
        // Assurez-vous d'utiliser les sélecteurs corrects correspondant à votre HTML
        html.find('#generate-synergy').click(this._onGenerateSynergy.bind(this));
        html.find('#increase-synergy').click(this._onIncreaseSynergy.bind(this));
        html.find('#decrease-synergy').click(this._onDecreaseSynergy.bind(this));
        html.find('#empty-pool').click(this._onEmptyPool.bind(this));
        html.find('#fill-pool').click(this._onFillPool.bind(this));
    }

    async _onGenerateSynergy(event) {
        event.preventDefault();
        const characters = game.actors.filter(a => a.type === "character");
        this.showCharacterSelectionModal(characters);
    }
    
    showCharacterSelectionModal(characters) {
        const content = `
            <form class="synergy-modal">
                <div class="modal-background"> <!-- Encapsulation pour le fond -->
                    <label class="group-title">Who is in the group?</label> <!-- Titre mis à jour et positionné au-dessus -->
                    <div class="character-selection">
                        ${characters.map(char => `
                            <div class="character-checkbox">
                                <label>
                                    <input type="checkbox" name="selected-chars" value="${char.id}">
                                    ${char.name}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </form>
        `;
    
        new Dialog({
            title: "Generate Synergy",
            content: content,
            buttons: {
                calculate: {
                    icon: '<i class="fas fa-calculator"></i>',
                    label: "Calculate Synergy",
                    callback: (html) => this.calculateSelectedSynergy(html),
                    classes: ['calculate-button', 'dialog-button']
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    classes: ['cancel-button', 'dialog-button']
                }
            },
            default: "calculate",
            classes: ["dialog-synergy-modal"]
        }).render(true);
    }
    

    async calculateSelectedSynergy(html) {
        const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
        const selectedCharacters = game.actors.filter(a => selectedCharIds.includes(a.id));
        
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
    
        if (this.validateAllRelationships(selectedCharacters)) {
            const synergyPoints = this.generateSynergyPoints(selectedCharacters);
            synergyData.maxSynergy = synergyPoints;
            synergyData.currentSynergy = synergyPoints; // Remplir automatiquement le pool avec la synergie maximale
            
            // Ajouter les membres sélectionnés à la liste des membres et mettre à jour l'affichage
            synergyData.characters = selectedCharacters.map(char => ({ id: char.id, name: char.name }));
            
            await game.settings.set("weave_of_echoes", "synergyData", synergyData);
            console.log(`Max synergy updated to ${synergyPoints}`); // Log pour confirmation
            this.render(); // Rafraîchir l'affichage pour montrer les nouveaux points de synergie et les membres
            ui.notifications.info(`Max Synergy updated: ${synergyPoints} points`);
        } else {
            ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before generating synergy.");
        }
    }
    

    validateAllRelationships(characters) {
        for (let i = 0; i < characters.length; i++) {
            for (let j = i + 1; j < characters.length; j++) {
                const char1 = characters[i];
                const char2 = characters[j];
                
                const rel1 = char1.system.relationships.find(r => r.characterName === char2.name);
                const rel2 = char2.system.relationships.find(r => r.characterName === char1.name);

                if (!rel1 || !rel2) {
                    console.log(`Missing relationship between ${char1.name} and ${char2.name}`);
                    return false;
                }
            }
        }
        return true;
    }

    generateSynergyPoints(characters) {
        let synergyPool = 0;
        const relationshipValues = {
            '-3': -3, // Hatred
            '-2': -2, // Hostility
            '-1': -1, // Displeasure
            '0': 0,   // Indifference (no contribution)
            '1': 1,   // Liking
            '2': 1,   // Friendship
            '3': 1    // Love
        };
    
        const mutualBonusValues = {
            '1': 1, // Liking
            '2': 2, // Friendship
            '3': 3  // Love
        };
    
        // Calculate individual contributions
        for (let char of characters) {
            let charContribution = 0;
            for (let rel of char.system.relationships) {
                const value = relationshipValues[rel.relationshipLevel] || 0;
                if (value > 0) {
                    charContribution += value;
                } else if (value < 0) {
                    charContribution -= Math.abs(value);
                }
                console.log(`${char.name} -> ${rel.characterName}: ${rel.relationshipLevel} (${value})`);
            }
            synergyPool += charContribution;
            console.log(`${char.name} total contribution: ${charContribution}`);
        }
    
        // Check for mutual positive relationships
        for (let i = 0; i < characters.length; i++) {
            for (let j = i + 1; j < characters.length; j++) {
                const char1 = characters[i];
                const char2 = characters[j];
                const rel1 = char1.system.relationships.find(r => r.characterName === char2.name);
                const rel2 = char2.system.relationships.find(r => r.characterName === char1.name);
        
                if (rel1 && rel2 && rel1.relationshipLevel === rel2.relationshipLevel && rel1.relationshipLevel > 0) {
                    const mutualBonus = mutualBonusValues[rel1.relationshipLevel] || 0;
                    synergyPool += mutualBonus;
                    console.log(`Mutual bonus for ${char1.name} and ${char2.name}: ${mutualBonus}`);
                } else {
                    console.log(`No mutual bonus for ${char1.name} and ${char2.name}`);
                }
            }
        }
        console.log("Total synergy pool:", synergyPool);
        return Math.max(0, synergyPool);  // Ensure synergy is never negative
    }

    
    async _onEmptyPool(event) {
        event.preventDefault();
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || {};
        synergyData.currentSynergy = 0;
        await game.settings.set("weave_of_echoes", "synergyData", synergyData);
        this.render();
    }
    
    async _onFillPool(event) {
        event.preventDefault();
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || {};
        synergyData.currentSynergy = synergyData.maxSynergy || 0;
        await game.settings.set("weave_of_echoes", "synergyData", synergyData);
        this.render();
    }
    
    async _onIncreaseSynergy(event) {
        event.preventDefault();
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        
        if (synergyData.currentSynergy < synergyData.maxSynergy) {
            synergyData.currentSynergy += 1;
            await game.settings.set("weave_of_echoes", "synergyData", synergyData);
            this.render(); // Rafraîchir l'affichage après la mise à jour
        } else {
            ui.notifications.warn("Current synergy is already at its maximum.");
        }
    }
    
    async _onDecreaseSynergy(event) {
        event.preventDefault();
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        
        if (synergyData.currentSynergy > 0) {
            synergyData.currentSynergy -= 1;
            await game.settings.set("weave_of_echoes", "synergyData", synergyData);
            this.render(); // Rafraîchir l'affichage après la mise à jour
        } else {
            ui.notifications.warn("Current synergy is already at its minimum.");
        }
    }
    
    _onEditMaxSynergy(event) {
        event.preventDefault();
        const currentMax = game.settings.get("weave_of_echoes", "maxSynergyPoints") || 0;
        new Dialog({
            title: "Edit Max Synergy",
            content: `<input type="number" id="new-max-synergy" value="${currentMax}">`,
            buttons: {
                save: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Save",
                    callback: (html) => {
                        const newMax = parseInt(html.find('#new-max-synergy').val());
                        if (!isNaN(newMax) && newMax >= 0) {
                            game.settings.set("weave_of_echoes", "maxSynergyPoints", newMax);
                            this.render();
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "save"
        }).render(true);
    }

}