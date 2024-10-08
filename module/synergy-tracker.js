export class SynergyTracker extends Application {
    constructor(options = {}) {
        super(options);
        this.appId = options.appId || "synergy-tracker";
    }

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

    get id() {
        return this.appId;
    }

    getData() {
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
        this.groupMembers = game.settings.get("weave_of_echoes", "groupMembers") || []; // Retrieve stored group members
        
        // Fetch the full actor objects based on stored IDs
        this.groupMembers = this.groupMembers.map(id => game.actors.get(id)).filter(actor => actor); 
        
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
        html.find('#reinitialize-synergy').click(this.reinitializeTracker.bind(this));
        
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
        
        // Vérifier si tous les personnages sélectionnés sont dans ce groupe ou aucun groupe
        const areAllInThisGroupOrNoGroup = selectedCharacters.every(char => 
          this.groupMembers.some(member => member.id === char.id) || !this.isCharacterInAnyGroup(char.id)
        );
      
        if (!areAllInThisGroupOrNoGroup) {
          ui.notifications.warn("Some selected characters are already in another group.");
          return;
        }
      
        if (this.validateAllRelationships(selectedCharacters)) {
          const synergyPoints = this.generateSynergyPoints(selectedCharacters);
          let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
          synergyData.maxSynergy = synergyPoints;
          synergyData.currentSynergy = synergyPoints;
          synergyData.characters = selectedCharacters.map(char => ({ id: char.id, name: char.name }));
          
          await game.settings.set("weave_of_echoes", "synergyData", synergyData);
          await game.settings.set("weave_of_echoes", "groupMembers", selectedCharIds);
      
          console.log(`Max synergy updated to ${synergyPoints}`);
          this.render();
          ui.notifications.info(`Max Synergy updated: ${synergyPoints} points`);
        } else {
          ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before generating synergy.");
        }
      
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
    
        // Ensure the group size is between 2 and 5
        const groupSize = Math.max(2, Math.min(characters.length, 5));
    
        // Calculate base synergy points based on group size
        const basePointsPerCharacter = (groupSize <= 3) ? 4 : 3;
        synergyPool = groupSize * basePointsPerCharacter;
    
        console.log(`Group size: ${groupSize}, Base synergy points per character: ${basePointsPerCharacter}, Total base: ${synergyPool}`);
    
        // Create a set of selected character names for easy lookup
        const selectedCharacterNames = new Set(characters.map(char => char.name));
        console.log("Selected Character Names: ", selectedCharacterNames);
    
        // Loop through all pairs of characters to calculate synergy modifiers
        for (let i = 0; i < groupSize; i++) {
            for (let j = i + 1; j < groupSize; j++) {
                const char1 = characters[i];
                const char2 = characters[j];
                const rel1 = char1.system.relationships.find(r => r.characterName === char2.name);
                const rel2 = char2.system.relationships.find(r => r.characterName === char1.name);
    
                if (rel1 && rel2) {
                    let relationshipModifier = 0;
    
                    // Check relationship levels between the pair
                    if (rel1.relationshipLevel > 0 && rel2.relationshipLevel > 0) {
                        // Mutually positive relationships (e.g., Love + Love or Love + Friendship)
                        relationshipModifier = 2;
                    } else if (rel1.relationshipLevel < 0 && rel2.relationshipLevel < 0) {
                        // Mutually negative relationships (e.g., Hatred + Hostility)
                        relationshipModifier = -2;
                    } else if ((rel1.relationshipLevel < 0 && rel2.relationshipLevel >= 0) ||
                               (rel2.relationshipLevel < 0 && rel1.relationshipLevel >= 0)) {
                        // Relationships involving one negative (e.g., Hatred + Indifferent)
                        relationshipModifier = -1;
                    }
                    // Note: Indifferent relationships (0) don't add or subtract points
    
                    // Add the relationship modifier to the synergy pool
                    synergyPool += relationshipModifier;
                    console.log(`Relationship between ${char1.name} and ${char2.name}: Modifier = ${relationshipModifier}`);
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
  const groupMemberIds = game.settings.get("weave_of_echoes", "groupMembers") || [];
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
        callback: (html) => this.calculateSynergicManeuverCost(html)
      },
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Apply Cost",
        callback: async (html) => {
          await this.applySynergyCost(html);
          ui.notifications.info("Synergy cost applied!");
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "calculate",
    close: () => {}
  });

  dialog.render(true);
}
    
    
      
    
    async calculateSelectedSynergy(html) {
        const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
        const selectedCharacters = game.actors.filter(a => selectedCharIds.includes(a.id));
        
        // Vérifier si tous les personnages sélectionnés sont dans ce groupe ou aucun groupe
        const areAllInThisGroupOrNoGroup = selectedCharacters.every(char => 
          this.groupMembers.some(member => member.id === char.id) || !this.isCharacterInAnyGroup(char.id)
        );
      
        if (!areAllInThisGroupOrNoGroup) {
          ui.notifications.warn("Some selected characters are already in another group.");
          return;
        }
      
        if (this.validateAllRelationships(selectedCharacters)) {
          const synergyPoints = this.generateSynergyPoints(selectedCharacters);
          let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0, characters: [] };
          synergyData.maxSynergy = synergyPoints;
          synergyData.currentSynergy = synergyPoints;
          synergyData.characters = selectedCharacters.map(char => ({ id: char.id, name: char.name }));
          
          await game.settings.set("weave_of_echoes", "synergyData", synergyData);
          await game.settings.set("weave_of_echoes", "groupMembers", selectedCharIds);
      
          console.log(`Max synergy updated to ${synergyPoints}`);
          this.render();
          ui.notifications.info(`Max Synergy updated: ${synergyPoints} points`);
        } else {
          ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before generating synergy.");
        }
      
        this.groupMembers = selectedCharacters;
      }
    
    
      isCharacterInAnyGroup(characterId) {
        const isInThisGroup = this.groupMembers.some(member => member.id === characterId);
        const isInOtherGroups = Object.values(game.weaveOfEchoes.additionalTrackers || {}).some(tracker => 
          tracker !== this && tracker.groupMembers.some(member => member.id === characterId)
        );
        return isInThisGroup || isInOtherGroups;
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

    incrementMaxSynergy() {
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        synergyData.maxSynergy += 1;
        game.settings.set("weave_of_echoes", "synergyData", synergyData);
        this.render(); // Mettre à jour l'affichage du Synergy Tracker
    }
    
    // Fonction pour décrémenter la valeur maximale de synergie
    decrementMaxSynergy() {
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        if (synergyData.maxSynergy > 1) {
            synergyData.maxSynergy -= 1;
            game.settings.set("weave_of_echoes", "synergyData", synergyData);
            this.render(); // Mettre à jour l'affichage du Synergy Tracker
        } else {
            ui.notifications.warn("La valeur maximale de synergie doit être au moins 1.");
        }
    }

    calculateSynergicManeuverCost(html) {
        // Récupérer les identifiants des personnages sélectionnés
        const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
        const selectedCharacters = selectedCharIds.map(id => game.actors.get(id)).filter(actor => actor);
      
        if (selectedCharacters.length < 2) {
          html.find('#maneuver-cost').text('Select at least two characters');
          return;
        }
      
        let totalCost = 0;
      
        console.log("Calculating cost for selected characters:", selectedCharacters.map(char => char.name));
      
        // Parcourir les paires de personnages sélectionnés pour calculer le coût
        for (let i = 0; i < selectedCharacters.length; i++) {
          for (let j = i + 1; j < selectedCharacters.length; j++) {
            const char1 = selectedCharacters[i];
            const char2 = selectedCharacters[j];
      
            const rel1 = char1.system.relationships.find(r => r.characterName === char2.name);
            const rel2 = char2.system.relationships.find(r => r.characterName === char1.name);
      
            if (!rel1 || !rel2) {
              console.log(`Relation not found between ${char1.name} and ${char2.name}`);
              continue;
            }
      
            console.log(`Relation between ${char1.name} and ${char2.name}:`, rel1, rel2);
      
            // Définir les niveaux de relation
            const relationValues = {
              '-3': 7,  // Haine
              '-2': 6,  // Hostilité
              '-1': 5,  // Déplaisir
              '0': 4,   // Indifférence
              '1': 3,   // Sympathie
              '2': 2,   // Amitié
              '3': 1    // Amour
            };
      
            // Calculer le coût de la paire
            const level1 = relationValues[rel1.relationshipLevel];
            const level2 = relationValues[rel2.relationshipLevel];
            let pairCost = level1 + level2;
      
            // Appliquer une réduction si les relations sont mutuellement positives
            if (rel1.relationshipLevel > 0 && rel1.relationshipLevel === rel2.relationshipLevel) {
              pairCost -= 2;
              console.log(`Mutual positive relationship found between ${char1.name} and ${char2.name}, applying -2 discount.`);
            }
      
            // S'assurer que le coût minimal est de 1
            pairCost = Math.max(1, pairCost);
      
            console.log(`Total cost for ${char1.name} and ${char2.name}: ${pairCost}`);
            totalCost += pairCost;
          }
        }
      
        console.log("Final total maneuver cost:", totalCost);
        // Mettre à jour le champ de coût dans la modale
        html.find('#maneuver-cost').text(totalCost);
      }

    async reinitializeTracker() {
        this.groupMembers = [];
        let synergyData = { currentSynergy: 0, maxSynergy: 0, characters: [] };
        await game.settings.set("weave_of_echoes", "synergyData", synergyData);
        await game.settings.set("weave_of_echoes", "groupMembers", []);
        this.render(true);
      }
}

// Ajouter le hook `renderSynergyTracker` en dehors de la classe
Hooks.on('renderSynergyTracker', (app, html, data) => {
    // Assurez-vous que vous êtes bien sur la bonne instance de SynergyTracker
    const synergyTracker = app;

    // Ajouter un écouteur sur le bouton pour modifier la valeur maximale de Synergy
    html.find('#edit-max-synergy-button').on('click', () => {
        synergyTracker._onEditMaxSynergy(); // Fonction pour ouvrir la modal de modification
    });

    // Ajouter un écouteur sur le bouton pour augmenter la valeur maximale
    html.find('#increase-max-synergy').on('click', synergyTracker.incrementMaxSynergy.bind(synergyTracker));

    // Ajouter un écouteur sur le bouton pour diminuer la valeur maximale
    html.find('#decrease-max-synergy').on('click', synergyTracker.decrementMaxSynergy.bind(synergyTracker));
});