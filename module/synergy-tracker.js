import { WoeActorSheet } from '../module/sheets/actor-sheet.mjs';


export class SynergyTracker extends Application {
  // Initialisation de la liste globale des membres assignés
  static assignedMembers = new Set();

  constructor(options) {
    super(options);
    this.data = foundry.utils.mergeObject({
        currentSynergy: 0,
        maxSynergy: 0,
        characters: [],
        selectedCharacters: []
    }, options.data);

    // Initialiser tous les groupes, y compris le groupe 1, comme vides
    this.initializeSynergy();
}

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/weave_of_echoes/templates/synergy-tracker.hbs",
      width: 300,
      height: 400,
      resizable: true,
    });
  }

  getData() {
    const hiddenCharacters = this.data.characters.reduce((acc, char) => {
      const actor = game.actors.getName(char);
      acc[char] = actor?.getFlag('weave_of_echoes', 'synergyHidden') || false;
      return acc;
    }, {});
    const selectedCharactersObj = this.data.selectedCharacters.reduce((acc, char) => {
      acc[char] = true;
      return acc;
    }, {});
  
    return {
      currentSynergy: this.data.currentSynergy,
      maxSynergy: this.data.maxSynergy,
      characters: this.data.characters,
      selectedCharacters: selectedCharactersObj,
      color: this.data.color,
      title: this.options.title,
      appId: this.appId,
      maneuverCost: this.calculateManeuverCost(),
      hiddenCharacters: hiddenCharacters,
    };
  }
  
  activateListeners(html) {
    super.activateListeners(html);

    html.find('#increase-current-synergy').click(this._onIncreaseCurrentSynergy.bind(this));
    html.find('#decrease-current-synergy').click(this._onDecreaseCurrentSynergy.bind(this));
    html.find('#increase-max-synergy').click(this._onIncreaseMaxSynergy.bind(this));
    html.find('#decrease-max-synergy').click(this._onDecreaseMaxSynergy.bind(this));
    html.find('#empty-pool').click(this._onEmptyPool.bind(this));
    html.find('#fill-pool').click(this._onFillPool.bind(this));
    html.find('#reset-max-value').click(this._onResetMaxValue.bind(this));
    html.find('#manage-members').click(this._onManageMembers.bind(this));
    html.find('#apply-synergy-cost').click(this._onApplySynergyCost.bind(this));
    html.find('.member-item').click(this._onMemberSelection.bind(this));
    html.find('.remove-member').click(this._onRemoveMember.bind(this));
    html.find('.add-member').click(this._onAddMember.bind(this));
    html.find('.eye-toggle').click(this._onEyeToggle.bind(this));
  }

  updateCharacterSheets() {
    this.data.characters.forEach(charName => {
      const actor = game.actors.getName(charName);
      if (actor && actor.sheet) {
        actor.sheet.render(false);
      }
    });
  }

  _onEyeToggle(event) {
    event.preventDefault();
    const characterName = event.currentTarget.dataset.character;
    const isHidden = $(event.currentTarget).find('i').toggleClass('fa-eye fa-eye-slash').hasClass('fa-eye-slash');
    
    const actor = game.actors.getName(characterName);
    if (actor) {
      actor.setFlag('weave_of_echoes', 'synergyHidden', isHidden);
      // Notifier la fiche de personnage
      Hooks.callAll('synergyVisibilityChanged', actor, isHidden);
    }
    
    // Pas besoin de mettre à jour l'affichage du SynergyTracker
  }



  initializeSynergy() {
    this.data.maxSynergy = this.calculateMaxSynergy();
    this.data.currentSynergy = this.data.maxSynergy;
  }

  async _updateTracker() {
    await this.render(false);
  }
  _onIncreaseCurrentSynergy(event) {
    event.preventDefault();
    if (this.data.currentSynergy < this.data.maxSynergy) {
        this.data.currentSynergy++;
        this.updateCharacterSheets();
        this.render(false);
    } else {
        ui.notifications.warn("Current Synergy is already at maximum.");
    }
}

_onDecreaseCurrentSynergy(event) {
    event.preventDefault();
    if (this.data.currentSynergy > 0) {
        this.data.currentSynergy--;
        this.updateCharacterSheets();
        this.render(false);
    } else {
        ui.notifications.warn("Current Synergy is already at minimum.");
    }
}

_onIncreaseMaxSynergy(event) {
    event.preventDefault();
    this.data.maxSynergy++;
    this.updateCharacterSheets();
    this.render(false);
}

_onDecreaseMaxSynergy(event) {
    event.preventDefault();
    if (this.data.maxSynergy > 0) {
        this.data.maxSynergy--;
        this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
        this.updateCharacterSheets();
        this.render(false);
    } else {
        ui.notifications.warn("Max Synergy is already at minimum.");
    }
}

_onEmptyPool(event) {
  event.preventDefault();
  this.data.currentSynergy = 0;
  this.updateCharacterSheets();
  this.render(false); // Redessine le tracker
}

_onFillPool(event) {
  event.preventDefault();
  this.data.currentSynergy = this.data.maxSynergy;
  this.updateCharacterSheets();
  this.render(false); // Redessine le tracker
}
_onResetMaxValue(event) {
  event.preventDefault();
  this.data.maxSynergy = this.calculateMaxSynergy();
  this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
  this.updateCharacterSheets();
  this.render(false); // Redessine le tracker
}
  _onManageMembers(event) {
    event.preventDefault();
    this.showMemberManagementModal();
  }
  _onMemberSelection(event) {
    const characterName = event.currentTarget.dataset.character;

    if (!Array.isArray(this.data.selectedCharacters)) {
        this.data.selectedCharacters = [];
    }

    const index = this.data.selectedCharacters.indexOf(characterName);

    if (index > -1) {
        // Deselect the character
        this.data.selectedCharacters.splice(index, 1);
    } else {
        // Add the character to the selected list
        this.data.selectedCharacters.push(characterName);
    }

    // Log for debugging
    console.log('Selected Characters in Synergy Tracker:', this.data.selectedCharacters);

    // Re-render the tracker to reflect the changes
    this.render(false);
}

  
  _onRemoveMember(event) {
    event.preventDefault();
    const characterName = event.currentTarget.dataset.character;

    const index = this.data.characters.indexOf(characterName);
    if (index > -1) {
        this.data.characters.splice(index, 1);
    }

    const selectedIndex = this.data.selectedCharacters.indexOf(characterName);
    if (selectedIndex > -1) {
        this.data.selectedCharacters.splice(selectedIndex, 1);
    }

    SynergyTracker.assignedMembers.delete(characterName);

    this.data.maxSynergy = this.calculateMaxSynergy();
    this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);

    this.updateCharacterSheets();
    this.render(false); // Redessine le tracker
   
}


  _onApplySynergyCost(event) {
    event.preventDefault();
    const cost = this.calculateManeuverCost();
    if (this.data.currentSynergy >= cost) {
      this.data.currentSynergy -= cost;
      
      ui.notifications.info(`Applied synergy cost: ${cost} points`);
    } else {
      ui.notifications.warn("Not enough synergy points to apply the cost.");
    }
  }

  _onAddMember(event) {
    event.preventDefault();
  
    // Filtrer les personnages disponibles qui ne sont pas déjà dans le groupe
    const availableCharacters = game.actors.filter(actor =>
      actor.type === "character" && !this.data.characters.includes(actor.name)
    );
  
    if (!availableCharacters.length) {
      ui.notifications.warn("No available characters to add.");
      return;
    }
  
    const content = `
      <form>
        <div class="form-group">
          <label>Select Members to Add:</label>
          ${availableCharacters.map(character => `
            <div>
              <label>
                <input type="checkbox" name="add-member" value="${character.name}">
                ${character.name}
              </label>
            </div>
          `).join('')}
        </div>
      </form>
    `;
  
    new Dialog({
      title: "Add Members",
      content,
      buttons: {
        add: {
          label: "Add Selected",
          callback: (html) => {
            const selectedMembers = Array.from(html.find('input[name="add-member"]:checked')).map(input => input.value);
  
            if (!selectedMembers.length) {
              ui.notifications.warn("No members selected to add.");
              return;
            }
  
            selectedMembers.forEach(memberName => {
              if (!this.data.characters.includes(memberName)) {
                this.data.characters.push(memberName);
              }
            });
  
            this.data.maxSynergy = this.calculateMaxSynergy();
            this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
            this.updateCharacterSheets();
            this.render(false);
          }
        },
        cancel: {
          label: "Cancel"
        }
      }
    }).render(true);
  }
  
  _addSelectedMembers(html) {
    const selectedMembers = Array.from(html.find('input[name="add-member"]:checked')).map(input => input.value);

    if (!selectedMembers.length) {
        ui.notifications.warn("No members selected to add.");
        return;
    }

    selectedMembers.forEach(memberName => {
        if (!this.data.characters.includes(memberName)) {
            this.data.characters.push(memberName);
        }
        SynergyTracker.assignedMembers.add(memberName);
    });

    this.data.maxSynergy = this.calculateMaxSynergy();
    this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);

    this.updateCharacterSheets();
    this.render(false); // Redessine le tracker
    Hooks.callAll('updateSynergyTracker', this);
}



  updateGroupMembers(html) {
    const selectedMembers = Array.from(html.find('input[name="group-member"]:checked'))
      .map(input => game.actors.get(input.value).name);
    
    this.data.characters = selectedMembers;
    this.data.selectedCharacters = [];
    this.initializeSynergy();
    
  }

  calculateMaxSynergy() {
    let synergyScore = 0;
    const groupCharacters = this.data.characters.map(name => game.actors.getName(name));

    // Définir le nombre de points de base en fonction du nombre de personnages dans le groupe
    const pointsDeBase = groupCharacters.length <= 3 ? 0 : 0;

    // Ajouter les points de base pour chaque personnage du groupe
    synergyScore += pointsDeBase * groupCharacters.length;

    // Calculer la synergie basée sur les relations entre chaque paire unique de personnages
    for (let i = 0; i < groupCharacters.length; i++) {
        for (let j = i + 1; j < groupCharacters.length; j++) {
            const char1 = groupCharacters[i];
            const char2 = groupCharacters[j];

            // Récupérer les relations entre les deux personnages
            const relationAB = char1.system.relationships.find(r => r.characterName === char2.name);
            const relationBA = char2.system.relationships.find(r => r.characterName === char1.name);

            if (relationAB && relationBA) {
                const levelAB = relationAB.relationshipLevel;
                const levelBA = relationBA.relationshipLevel;

                // Calculer la synergie selon les niveaux de relation
                if (levelAB > 0 && levelBA > 0) {
                    synergyScore += 2; // Les deux relations sont positives
                } else if (levelAB < 0 && levelBA < 0) {
                    synergyScore -= 2; // Les deux relations sont négatives
                } else if ((levelAB > 0 && levelBA === 0) || (levelAB === 0 && levelBA > 0)) {
                    synergyScore += 1; // Une relation positive et une relation neutre
                } else if ((levelAB < 0 && levelBA === 0) || (levelAB === 0 && levelBA < 0)) {
                    synergyScore -= 1; // Une relation négative et une relation neutre
                } else if ((levelAB > 0 && levelBA < 0) || (levelAB < 0 && levelBA > 0)) {
                    synergyScore -= 1; // Une relation positive et une relation négative
                }
            }
        }
    }

    return synergyScore; 
}

calculateManeuverCost() {
  // Vérifier si au moins deux personnages sont sélectionnés
  if (this.data.selectedCharacters.length < 2) {
    return "Select at least 2 characters";
  }

  let synergyCost = 0;

  // Fonction pour transformer les niveaux de relation en valeurs de coût
  const transformRelationValue = (value) => {
    switch (value) {
      case 3: return 1;  // Love
      case 2: return 2;  // Friendship
      case 1: return 3;  // Liking
      case 0: return 4;  // Indifference
      case -1: return 5; // Displeasure
      case -2: return 6; // Hostility
      case -3: return 7; // Hatred
      default: return 4; // Par défaut, Indifference
    }
  };

  // Parcourir chaque paire de membres sélectionnés
  for (let i = 0; i < this.data.selectedCharacters.length; i++) {
    for (let j = i + 1; j < this.data.selectedCharacters.length; j++) {
      const member1 = this.data.selectedCharacters[i];
      const member2 = this.data.selectedCharacters[j];
      
      const actor1 = game.actors.getName(member1);
      const actor2 = game.actors.getName(member2);

      // Récupérer les niveaux de relation et les transformer en valeurs de coût
      const relationAB = transformRelationValue(actor1.system.relationships.find(rel => rel.characterName === member2)?.relationshipLevel || 0);
      const relationBA = transformRelationValue(actor2.system.relationships.find(rel => rel.characterName === member1)?.relationshipLevel || 0);

      // Ajouter les coûts individuels à la synergie totale
      synergyCost += relationAB + relationBA;

      // Appliquer le discount si les relations sont mutuellement positives
      if (relationAB === relationBA && (relationAB <= 3)) { // Vérifier si Love-Love, Friendship-Friendship ou Liking-Liking
        synergyCost -= 2; // Réduction de 2 points pour les relations mutuellement positives
      }
    }
  }

  // Assurez-vous que le coût de synergie est toujours au moins 1
  return Math.max(1, synergyCost);
}


updateSynergyBasedOnRelationships(updatedActor) {
  if (this.data.characters.includes(updatedActor.name)) {
      // Récalculez la synergie maximale en fonction des relations mises à jour
      this.data.maxSynergy = this.calculateMaxSynergy();
      this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
      
      this.updateCharacterSheets(); // Met à jour les fiches de personnage
  }
}

  toggleMemberSelection(characterName) {
    const index = this.data.selectedCharacters.indexOf(characterName);
    if (index > -1) {
      // Si le personnage est déjà sélectionné, le désélectionner
      this.data.selectedCharacters.splice(index, 1);
    } else {
      // Sinon, l'ajouter aux personnages sélectionnés
      this.data.selectedCharacters.push(characterName);
    }
    this.calculateManeuverCost();
    this.render(false);
    // Mettre à jour la fiche de personnage concernée
    const actor = game.actors.getName(characterName);
    if (actor && actor.sheet) {
      actor.sheet.render(false);
    }
  }
}

// Hook pour écouter les mises à jour des relations et mettre à jour le Synergy Tracker
Hooks.on('updateSynergyTracker', (updatedActor) => {
  // Trouver tous les trackers de synergie ouverts et les mettre à jour
  for (let app of Object.values(ui.windows)) {
    if (app instanceof SynergyTracker) {
      app.updateSynergyBasedOnRelationships(updatedActor);
    }
  }
});