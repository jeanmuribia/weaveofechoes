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
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
        this.groupMembers = game.settings.get("weave_of_echoes", "groupMembers") || []; // Retrieve stored group members
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
        html.find('#synergic-maneuver').click(this._onSynergicManeuver.bind(this));
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
        
        // Synergy Data to store, including the group members' IDs
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
    
        if (this.validateAllRelationships(selectedCharacters)) {
            const synergyPoints = this.generateSynergyPoints(selectedCharacters);
            synergyData.maxSynergy = synergyPoints;
            synergyData.currentSynergy = synergyPoints;
    
            // Add the selected members to group members and store their IDs
            synergyData.characters = selectedCharacters.map(char => ({ id: char.id, name: char.name }));
            await game.settings.set("weave_of_echoes", "synergyData", synergyData);
            await game.settings.set("weave_of_echoes", "groupMembers", selectedCharIds);
    
            console.log(`Max synergy updated to ${synergyPoints}`);
            this.render(); // Refresh the Synergy Tracker display
            ui.notifications.info(`Max Synergy updated: ${synergyPoints} points`);
        } else {
            ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before generating synergy.");
        }
    
        // Update the local property with the current selected members
        this.groupMembers = selectedCharacters;
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

    async updateSynergyTrackerDisplay() {
        const synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
        const groupMemberIds = game.settings.get("weave_of_echoes", "groupMembers") || [];
    
        // Fetch the full actor objects based on stored IDs
        const groupMembers = groupMemberIds.map(id => game.actors.get(id)).filter(actor => actor);
        
        // Update synergy points display
        document.querySelector('.synergy-chip').innerHTML = `${synergyData.currentSynergy} / ${synergyData.maxSynergy}`;
    
        // Update the members list
        const membersList = document.querySelector('.members-list');
        if (membersList) {
            membersList.innerHTML = groupMembers.map(char => `<li class="member-item">${char.name}</li>`).join('');
        }
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

    _onSynergicManeuver(event) {
        event.preventDefault();
        this.showSynergicManeuverModal();
    }

    initializeSynergicManeuverButton() {
        document.querySelector('.synergic-maneuver-button').addEventListener('click', () => {
            this.showSynergicManeuverModal();
        });
    }
    
    showSynergicManeuverModal() {
        // Fetch group members from game settings (list of IDs)
        const groupMemberIds = game.settings.get("weave_of_echoes", "groupMembers") || [];
    
        // Retrieve the full actors from IDs
        const groupMembers = groupMemberIds.map(id => game.actors.get(id)).filter(actor => actor);
    
        const content = `
            <form class="synergic-maneuver-modal">
                <div class="form-group">
                    <label for="character-selection">Who is in the maneuver?</label>
                    <div class="character-selection">
                        ${groupMembers.map(char => `
                            <div class="character-checkbox">
                                <label>
                                    <input type="checkbox" name="selected-chars" value="${char.id}">
                                    ${char.name}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                    <div id="maneuver-result" class="maneuver-result">
                        Maneuver Cost: <span id="maneuver-cost">- points</span>
                    </div>
                </div>
            </form>
        `;
    
        const dialog = new Dialog({
            title: "Synergic Maneuver Cost",
            content: content,
            buttons: {
                calculate: {
                    icon: '<i class="fas fa-calculator"></i>',
                    label: "Calculate Cost",
                    callback: (html) => {
                        this.calculateSynergicManeuverCost(html);
                    },
                    classes: ['calculate-button']
                },
                apply: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Apply Cost",
                    callback: async (html) => {
                        await this.applySynergyCost(html);
                        ui.notifications.info("Synergy cost applied!");
                    },
                    classes: ['apply-button']
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    classes: ['cancel-button']
                }
            },
            default: "calculate",
            classes: ["dialog-synergy-modal"]
        });
    
        dialog.render(true);
    
        // Automatically calculate cost after rendering the modal
        dialog.element.ready(() => {
            this.calculateSynergicManeuverCost(dialog.element);
        });
    }
    
      
    
    calculateSynergicManeuverCost(html) {
        // Retrieve selected characters
        const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
        const selectedCharacters = this.groupMembers.filter(char => selectedCharIds.includes(char.id));
    
        if (selectedCharacters.length < 2) {
            // We need at least two characters for a synergy maneuver
            html.find('#maneuver-cost').text("Select at least two characters");
            return;
        }
    
        // Perform calculation
        let baseCost = 0;
        let gapCost = 0;
    
        // Assuming the same logic as before to calculate the cost
        for (let i = 0; i < selectedCharacters.length; i++) {
            for (let j = i + 1; j < selectedCharacters.length; j++) {
                const char1 = selectedCharacters[i];
                const char2 = selectedCharacters[j];
    
                // Ensure relationships property exists
                if (!char1.system.relationships || !char2.system.relationships) {
                    console.log(`${char1.name} or ${char2.name} does not have relationships defined.`);
                    continue;
                }
    
                // Find the relationship levels between characters
                const rel1 = char1.system.relationships.find(r => r.characterName === char2.name)?.relationshipLevel || 0;
                const rel2 = char2.system.relationships.find(r => r.characterName === char1.name)?.relationshipLevel || 0;
    
                // Calculate base cost from relationship levels
                const relationshipOrder = ['Love', 'Friendship', 'Liking'];
                baseCost += relationshipOrder.length - relationshipOrder.indexOf(rel1) || 0;
    
                // Calculate relationship gap cost
                gapCost += Math.abs(rel1 - rel2);
            }
        }
    
        const totalCost = baseCost + gapCost;
    
        // Update the maneuver cost field in the modal
        html.find('#maneuver-cost').text(`${totalCost} points`);
    }
    
    async applySynergyCost(html) {
        // Retrieve selected characters
        const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
        const selectedCharacters = this.groupMembers.filter(char => selectedCharIds.includes(char.id));
    
        if (selectedCharacters.length < 2) {
            ui.notifications.warn("Please select at least two characters for the maneuver.");
            return;
        }
    
        // Retrieve the calculated cost from the modal
        const costText = html.find('#maneuver-cost').text();
        const maneuverCost = parseInt(costText.split(" ")[0]);
    
        if (isNaN(maneuverCost)) {
            ui.notifications.error("Unable to apply cost. Invalid cost value.");
            return;
        }
    
        // Retrieve current synergy data and update it
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        
        if (synergyData.currentSynergy >= maneuverCost) {
            synergyData.currentSynergy -= maneuverCost;
            await game.settings.set("weave_of_echoes", "synergyData", synergyData);
            this.render(); // Refresh Synergy Tracker display
        } else {
            ui.notifications.error("Not enough synergy points to apply the cost.");
        }
    }
    

}