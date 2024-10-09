export class SynergyTracker extends Application {
  constructor(options = {}) {
    super(options);
    this.appId = options.appId || "synergy-tracker";
    this.color = options.color || this.getRandomPastelColor();
  }
  
  getRandomPastelColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 80%)`;
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
      let synergyData = game.settings.get("weave_of_echoes", "synergyData");
      return {
          currentSynergy: synergyData.currentSynergy,
          maxSynergy: synergyData.maxSynergy,
          groupMembers: synergyData.characters
      };
  }
    
    

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#increase-current-synergy').click((event) => this._onIncreaseCurrentSynergy(event));
    html.find('#decrease-current-synergy').click((event) => this._onDecreaseCurrentSynergy(event));
    html.find('#increase-max-synergy').click((event) => this._onIncreaseMaxSynergy(event));
    html.find('#decrease-max-synergy').click((event) => this._onDecreaseMaxSynergy(event));
    html.find('#generate-synergy').click((event) => this._onGenerateSynergy(event));
    html.find('#empty-pool').click((event) => this._onEmptyPool(event));
    html.find('#fill-pool').click((event) => this._onFillPool(event));
    html.find('#apply-synergy-cost').click((event) => this._onApplySynergyCost(event));
    html.find('#reset-tracker').click((event) => this._onResetTracker(event));
    html.find('.member-item').click((event) => this._onMemberSelection(event));
}

  _onGenerateSynergy(event) {
    event.preventDefault();
    const characters = game.actors.filter(a => a.type === "character");
    this.showCharacterSelectionModal(characters);
}
    

    async calculateSynergicManeuverCost(selectedCharIds) {
      const selectedCharacters = selectedCharIds.map(id => game.actors.get(id)).filter(actor => actor);
    
      if (selectedCharacters.length < 2) {
        ui.notifications.warn('Select at least two characters');
        return 0;
      }
    
      if (this.validateAllRelationships(selectedCharacters)) {
        const maneuverCost = this.calculateManeuverCost(selectedCharacters);
        console.log(`Maneuver cost calculated: ${maneuverCost}`);
        return maneuverCost;
      } else {
        ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before calculating maneuver cost.");
        return 0;
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
    
    _onIncreaseMaxSynergy(event) {
      event.preventDefault();
      let synergyData = game.settings.get("weave_of_echoes", "synergyData");
      synergyData.maxSynergy += 1;
      this._updateSynergyData(synergyData);
  }
  
  _onDecreaseMaxSynergy(event) {
      event.preventDefault();
      let synergyData = game.settings.get("weave_of_echoes", "synergyData");
      if (synergyData.maxSynergy > 0) {
          synergyData.maxSynergy -= 1;
          // Assurez-vous que currentSynergy ne dépasse pas maxSynergy
          synergyData.currentSynergy = Math.min(synergyData.currentSynergy, synergyData.maxSynergy);
          this._updateSynergyData(synergyData);
      }
  }
  
  async _updateSynergyData(synergyData) {
      await game.settings.set("weave_of_echoes", "synergyData", synergyData);
      this.render();
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
    
    _onIncreaseCurrentSynergy(event) {
      event.preventDefault();
      let synergyData = game.settings.get("weave_of_echoes", "synergyData");
      if (synergyData.currentSynergy < synergyData.maxSynergy) {
          synergyData.currentSynergy += 1;
          this._updateSynergyData(synergyData);
      }
  }
  
  _onDecreaseCurrentSynergy(event) {
      event.preventDefault();
      let synergyData = game.settings.get("weave_of_echoes", "synergyData");
      if (synergyData.currentSynergy > 0) {
          synergyData.currentSynergy -= 1;
          this._updateSynergyData(synergyData);
      }
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
    
      let d = new Dialog({
        title: "Synergic Maneuver Cost",
        content: content,
        buttons: {
          calculate: {
            icon: '<i class="fas fa-calculator"></i>',
            label: "Calculate Cost",
            callback: (html) => {
              this.calculateSynergicManeuverCost(html);
            }
          },
          apply: {
            icon: '<i class="fas fa-check"></i>',
            label: "Apply Cost",
            callback: (html) => this.applySynergyCost(html)
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel"
          }
        },
        default: "calculate",
        close: () => {}
      });
    
      d.render(true);
    
      // Ajout d'un listener personnalisé après le rendu de la modale
      d.element.on('click', '.dialog-button.calculate', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.calculateSynergicManeuverCost(d.element);
      });
    }
    
    
    async render(force = false, options = {}) {
      await super.render(force, options);
      this.element.css('--tracker-color', this.color);
      this.activateListeners(this.element);
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
        const costText = html.find('#maneuver-cost').text();
        const maneuverCost = parseInt(costText);
      
        if (isNaN(maneuverCost)) {
          ui.notifications.error("Unable to apply cost. Invalid cost value.");
          return;
        }
      
        let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
        
        if (synergyData.currentSynergy >= maneuverCost) {
          synergyData.currentSynergy -= maneuverCost;
          await game.settings.set("weave_of_echoes", "synergyData", synergyData);
          this.render(); // Refresh Synergy Tracker display
          ui.notifications.info(`Applied synergy cost: ${maneuverCost} points`);
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

    showCharacterSelectionModal(characters) {
      const content = `
          <form class="synergy-modal">
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
          </form>
      `;
  
      new Dialog({
          title: "Generate Max Synergy",
          content: content,
          buttons: {
              calculate: {
                  icon: '<i class="fas fa-calculator"></i>',
                  label: "Calculate Synergy",
                  callback: (html) => this.calculateSelectedSynergy(html)
              },
              cancel: {
                  icon: '<i class="fas fa-times"></i>',
                  label: "Cancel"
              }
          },
          default: "calculate"
      }).render(true);
  }

  calculateSynergicManeuverCost(html) {
    const selectedCharIds = Array.from(html.find('input[name="selected-chars"]:checked')).map(input => input.value);
    const selectedCharacters = selectedCharIds.map(id => game.actors.get(id)).filter(actor => actor);

    if (selectedCharacters.length < 2) {
        html.find('#maneuver-cost').text('Select at least two characters');
        return;
    }

    if (this.validateAllRelationships(selectedCharacters)) {
        const maneuverCost = this.calculateManeuverCost(selectedCharacters);
        html.find('#maneuver-cost').text(`${maneuverCost} points`);
        console.log(`Maneuver cost calculated: ${maneuverCost}`);
    } else {
        ui.notifications.error("Not all selected characters have relationships with each other. Please complete all relationships before calculating maneuver cost.");
        html.find('#maneuver-cost').text('Incomplete relationships');
    }
}

    async reinitializeTracker() {
        this.groupMembers = [];
        let synergyData = { currentSynergy: 0, maxSynergy: 0, characters: [] };
        await game.settings.set("weave_of_echoes", "synergyData", synergyData);
        await game.settings.set("weave_of_echoes", "groupMembers", []);
        this.render(true);
      }

      calculateManeuverCost(characters) {
        let totalCost = 0;
      
        for (let i = 0; i < characters.length; i++) {
          for (let j = i + 1; j < characters.length; j++) {
            const char1 = characters[i];
            const char2 = characters[j];
      
            const rel1 = char1.system.relationships.find(r => r.characterName === char2.name);
            const rel2 = char2.system.relationships.find(r => r.characterName === char1.name);
      
            if (rel1 && rel2) {
              const level1 = parseInt(rel1.relationshipLevel);
              const level2 = parseInt(rel2.relationshipLevel);
      
              let pairCost = 8 - Math.abs(level1) - Math.abs(level2);
      
              // Appliquer une réduction si les relations sont mutuellement positives
              if (level1 > 0 && level2 > 0) {
                pairCost -= 2;
              }
      
              // S'assurer que le coût minimal est de 1
              pairCost = Math.max(1, pairCost);
      
              totalCost += pairCost;
            }
          }
        }
      
        return totalCost;
      }

    
_onMemberSelection(event) {
  const memberId = event.currentTarget.dataset.id;
  const memberItem = event.currentTarget;
  
  if (memberItem.classList.contains('selected')) {
      memberItem.classList.remove('selected');
  } else {
      memberItem.classList.add('selected');
  }
  
  this._updateManeuverCost();
}

_updateManeuverCost() {
  const selectedMembers = this.element.find('.member-item.selected')
      .map((_, el) => game.actors.get(el.dataset.id))
      .get();
  
  if (selectedMembers.length < 2) {
      this.element.find('#maneuver-cost').text('Select at least two characters');
      return;
  }

  const cost = this.calculateManeuverCost(selectedMembers);
  this.element.find('#maneuver-cost').text(`${cost} points`);
}
    
async _onApplySynergyCost(event) {
  event.preventDefault();
  const costText = this.element.find('#maneuver-cost').text();
  const cost = parseInt(costText);
  
  if (isNaN(cost) || cost <= 0) {
    ui.notifications.warn("Invalid cost. Please calculate the cost first.");
    return;
  }

  await this.applySynergyCost(cost);
}

async applySynergyCost(cost) {
  let synergyData = game.settings.get("weave_of_echoes", "synergyData") || { currentSynergy: 0, maxSynergy: 0 };
  
  if (synergyData.currentSynergy >= cost) {
    synergyData.currentSynergy -= cost;
    await game.settings.set("weave_of_echoes", "synergyData", synergyData);
    this.render();
    ui.notifications.info(`Applied synergy cost: ${cost} points`);
  } else {
    ui.notifications.error("Not enough synergy points to apply the cost.");
  }
}
   
async _onResetTracker(event) {
  event.preventDefault();
  let synergyData = {
    currentSynergy: 0,
    maxSynergy: 0,
    characters: []
  };
  await game.settings.set("weave_of_echoes", "synergyData", synergyData);
  await game.settings.set("weave_of_echoes", "groupMembers", []);
  this.groupMembers = [];
  this.render();
}
}
    // Mettez à jour cette méthode pour qu'elle fonctionne avec le nouveau système
   



