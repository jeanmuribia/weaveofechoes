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
        selectedCharacters: [],
        visibleToPlayers: {}
    }, options.data);

    // Initialiser `selectedMembers` comme un tableau vide
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
    const maneuverCost = this.calculateManeuverCost();
    return {
      currentSynergy: this.data.currentSynergy,
      maxSynergy: this.data.maxSynergy,
      characters: this.data.characters,
      selectedCharacters: this.data.selectedCharacters,
      color: this.data.color,
      title: this.options.title,
      appId: this.appId,
      maneuverCost: maneuverCost,
      visibleToPlayers: this.data.visibleToPlayers  
    };
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    console.log("Activation des listeners sur les boutons");

    html.find('#increase-current-synergy').click(this._onIncreaseCurrentSynergy.bind(this));
    html.find('#decrease-current-synergy').click(this._onDecreaseCurrentSynergy.bind(this));
    html.find('#increase-max-synergy').click(this._onIncreaseMaxSynergy.bind(this));
    html.find('#decrease-max-synergy').click(this._onDecreaseMaxSynergy.bind(this));
    html.find('#empty-pool').click(this._onEmptyPool.bind(this));
    html.find('#fill-pool').click(this._onFillPool.bind(this));
    html.find('#reset-max-value').click(this._onResetMaxValue.bind(this));
    html.find('#apply-synergy-cost').click(this._onApplySynergyCost.bind(this));
    html.find('#add-members').click(this._onAddMember.bind(this));
    html.find('.synergy-toggle-visibility').click(this._onToggleVisibility.bind(this));
    html.find('.synergy-remove-member').click(this._onRemoveMember.bind(this));
    html.find('.synergy-character-button').click(this._onCharacterSelect.bind(this));
}

_onCharacterSelect(event) {
  const characterName = event.currentTarget.dataset.character;
  const index = this.data.selectedCharacters.indexOf(characterName);
  if (index > -1) {
    this.data.selectedCharacters.splice(index, 1);
  } else {
    this.data.selectedCharacters.push(characterName);
  }
  this.updateManeuverCost();
  this.render(false);
}

selectMember(characterName) {
  const index = this.data.selectedCharacters.indexOf(characterName);
  if (index > -1) {
    this.data.selectedCharacters.splice(index, 1);
  } else {
    this.data.selectedCharacters.push(characterName);
  }
  this.updateCharacterSelectionVisuals();
  this.updateManeuverCost();
  this.render(false);
}

updateCharacterSelectionVisuals() {
  this.element.find('.synergy-character-button').each((i, el) => {
    const $el = $(el);
    const charName = $el.data('character');
    if (this.data.selectedCharacters.includes(charName)) {
      $el.addClass('synergy-highlight');
    } else {
      $el.removeClass('synergy-highlight');
    }
  });
}

updateManeuverCost() {
  this.maneuverCost = this.calculateManeuverCost();
  this.render(false);
}


  updateCharacterSheets() {
    this.data.characters.forEach(charName => {
      const actor = game.actors.getName(charName);
      if (actor && actor.sheet) {
        actor.sheet.render(false);
      }
    });
  }

  _onIncreaseMaxSynergy(event) {
    event.preventDefault();
    this.data.maxSynergy++;
    this._updateTracker();
    this.updateCharacterSheets(); 


  }

  _onDecreaseMaxSynergy(event) {
    event.preventDefault();
    if (this.data.maxSynergy > 0) {
      this.data.maxSynergy--;
      this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
      this._updateTracker();
      this.updateCharacterSheets(); 
    }
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
      this._updateTracker();
      this.updateCharacterSheets(); 
    }
  }

  _onDecreaseCurrentSynergy(event) {
    event.preventDefault();
    if (this.data.currentSynergy > 0) {
      this.data.currentSynergy--;
      this._updateTracker();
      this.updateCharacterSheets(); 
    }
  }

  _onEmptyPool(event) {
    event.preventDefault();
    this.data.currentSynergy = 0;
    this._updateTracker();
    this.updateCharacterSheets(); 
  }

  _onFillPool(event) {
    event.preventDefault();
    this.data.currentSynergy = this.data.maxSynergy;
    this._updateTracker();
    this.updateCharacterSheets(); 
  }

  _onResetMaxValue(event) {
    event.preventDefault();
    this.data.maxSynergy = this.calculateMaxSynergy();
    this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
    this._updateTracker();
    this.updateCharacterSheets(); 
  }


  _onMemberSelection(event) {
    const characterName = event.currentTarget.dataset.character;
    const index = this.data.selectedCharacters.indexOf(characterName);
    if (index > -1) {
      this.data.selectedCharacters.splice(index, 1);
      event.currentTarget.classList.remove('selected', 'synergy-highlight');
    } else {
      this.data.selectedCharacters.push(characterName);
      event.currentTarget.classList.add('selected', 'synergy-highlight');
    }
    this.updateManeuverCost();
    this.render(false);
  }

  _onRemoveMember(event) {
    event.preventDefault();
    const characterName = event.currentTarget.dataset.character;
    
    // Supprime le personnage de la liste des membres du groupe
    const index = this.data.characters.indexOf(characterName);
    if (index > -1) {
      this.data.characters.splice(index, 1);
    }
  
    // Supprime également le personnage de la liste des personnages sélectionnés, s'il est présent
    const selectedIndex = this.data.selectedCharacters.indexOf(characterName);
    if (selectedIndex > -1) {
      this.data.selectedCharacters.splice(selectedIndex, 1);
    }
  
    // Retire le membre de la liste globale des membres assignés
    SynergyTracker.assignedMembers.delete(characterName);
  
    // Recalculer la valeur max de Synergy après la suppression
    this.data.maxSynergy = this.calculateMaxSynergy();
    this.data.currentSynergy = Math.min(this.data.currentSynergy, this.data.maxSynergy);
  
    this._updateTracker();
    this.render(false);  // Ajoutez cette ligne pour forcer le rendu
  }

_onToggleVisibility(event) {
  const characterName = event.currentTarget.dataset.character;
  this.toggleVisibility(characterName);
}

toggleVisibility(characterName) {
  this.data.visibleToPlayers[characterName] = !this.data.visibleToPlayers[characterName];
  this.render(false);
  // Mettre à jour la fiche de personnage concernée
  const actor = game.actors.getName(characterName);
  if (actor && actor.sheet) {
    actor.sheet.render(false);
  }
}

  _onApplySynergyCost(event) {
    event.preventDefault();
    const cost = this.calculateManeuverCost();
    if (this.data.currentSynergy >= cost) {
      this.data.currentSynergy -= cost;
      this._updateTracker();
      ui.notifications.info(`Applied synergy cost: ${cost} points`);
    } else {
      ui.notifications.warn("Not enough synergy points to apply the cost.");
    }
  }

  _onAddMember(event) {
    event.preventDefault();

    // Filtrer les personnages disponibles qui ne sont pas déjà dans le groupe et qui ne sont pas assignés à d'autres groupes
    const availableCharacters = game.actors.filter(actor => 
        actor.type === "character" && 
        !this.data.characters.includes(actor.name) &&
        !SynergyTracker.assignedMembers.has(actor.name) // Vérifier si le personnage est déjà assigné à un groupe
    );

    // Créer le contenu HTML pour la modale
    const content = `
      <form>
        <div class="form-group">
          <label>Select a Member to Add:</label>
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

    // Afficher la modale avec les membres disponibles
    new Dialog({
        title: "Add Members",
        content: content,
        buttons: {
            add: {
                icon: '<i class="fas fa-user-plus"></i>',
                label: "Add Selected",
                callback: (html) => this._addSelectedMembers(html)
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        }
    }).render(true);
}


_addSelectedMembers(html) {
  const selectedMembers = Array.from(html.find('input[name="add-member"]:checked')).map(input => input.value);

  // Ajouter les nouveaux membres au groupe
  this.data.characters = [...new Set([...this.data.characters, ...selectedMembers])];

  // Mettre à jour chaque personnage du groupe
  this.data.characters.forEach(charName => {
    const actor = game.actors.getName(charName);
    if (actor) {
      // Créer une liste de membres du groupe, excluant le personnage lui-même
      const groupMembers = this.data.characters.filter(member => member !== charName);
      
      // Mettre à jour le flag du personnage avec la liste des membres du groupe
      actor.setFlag("weave_of_echoes", "groupMembers", groupMembers);
      
      // Initialiser les membres sélectionnés pour le calcul de synergie si ce n'est pas déjà fait
      if (!actor.getFlag("weave_of_echoes", "selectedGroupMembers")) {
        actor.setFlag("weave_of_echoes", "selectedGroupMembers", []);
      }
    }
  });

  // Recalculer la synergie maximale
  this.data.maxSynergy = this.calculateMaxSynergy();
  this._updateTracker();

  // Notifier le système que le groupe a été mis à jour
  Hooks.call('updateSynergyGroup', this);
}


updateGroupMembers(html) {
  const selectedMembers = Array.from(html.find('input[name="group-member"]:checked'))
    .map(input => game.actors.get(input.value).name);
  
  // Met à jour la liste des personnages dans le groupe
  this.data.characters = selectedMembers;
  this.data.selectedCharacters = [];

  // Initialise la synergie en fonction des nouveaux membres du groupe
  this.initializeSynergy();

  // Mets à jour le tracker visuel et les fiches des personnages liés
  this._updateTracker();

  // Recalculer les membres du groupe et les associer dans chaque fiche de personnage
  this.data.characters.forEach(charName => {
    const actor = game.actors.getName(charName);
    if (actor) {
      const groupMembers = this.data.characters.filter(member => member !== charName);
      
      // Met à jour le flag 'groupMembers' pour chaque personnage
      actor.setFlag("weave_of_echoes", "groupMembers", groupMembers);

      // Initialise les membres sélectionnés pour la synergie
      if (!actor.getFlag("weave_of_echoes", "selectedGroupMembers")) {
        actor.setFlag("weave_of_echoes", "selectedGroupMembers", []);
      }

      // Rendu visuel de la fiche de personnage pour refléter les nouveaux membres
      actor.sheet.render(false);
    }
  });

  // Notifie le système que les membres du groupe ont été mis à jour
  Hooks.call('updateSynergyGroup', this);
}


  calculateMaxSynergy() {
    let maxSynergy = 0;
  
    // Récupérer tous les membres du groupe de synergie
    const allMembers = this.data.characters.map(name => game.actors.getName(name));
  
    // Définir le nombre de points de base par personnage en fonction du nombre total de personnages
    let basePointsPerCharacter;
    if (allMembers.length === 2) {
      basePointsPerCharacter = 4; // 4 points par personnage pour 2 personnages
    } else if (allMembers.length === 3) {
      basePointsPerCharacter = 3; // 3 points par personnage pour 3 personnages
    } else if (allMembers.length >= 4) {
      basePointsPerCharacter = 2; // 2 points par personnage pour 4 personnages ou plus
    } else {
      basePointsPerCharacter = 0; // Si moins de 2 personnages, pas de points de base
    }
  
    // Ajouter les points de base pour chaque personnage dans la synergie maximale
    maxSynergy += allMembers.length * basePointsPerCharacter;
  
    // Calculer la synergie maximale en se basant sur les relations entre les personnages
    for (let i = 0; i < allMembers.length; i++) {
      for (let j = i + 1; j < allMembers.length; j++) {
        const member1 = allMembers[i];
        const member2 = allMembers[j];
  
        if (member1 && member2) {
          const relationAB = member1.system.relationships.find(rel => rel.characterName === member2.name)?.relationshipLevel || 0;
          const relationBA = member2.system.relationships.find(rel => rel.characterName === member1.name)?.relationshipLevel || 0;
  
          // Ajouter des points en fonction du niveau de relation
          if (relationAB > 0 && relationBA > 0) {
            maxSynergy += 2; // Les deux relations sont positives
          } else if (relationAB < 0 && relationBA < 0) {
            maxSynergy -= 2; // Les deux relations sont négatives
          } else if ((relationAB > 0 && relationBA === 0) || (relationAB === 0 && relationBA > 0)) {
            maxSynergy += 1; // Une relation positive et une relation neutre
          } else if ((relationAB < 0 && relationBA === 0) || (relationAB === 0 && relationBA < 0)) {
            maxSynergy -= 1; // Une relation négative et une relation neutre
          } else if ((relationAB > 0 && relationBA < 0) || (relationAB < 0 && relationBA > 0)) {
            maxSynergy -= 1; // Une relation positive et une relation négative
          }
        }
      }
    }
  
    console.log("Calculated max synergy:", maxSynergy);
    return maxSynergy;
  }

  calculateManeuverCost() {
    if (this.data.selectedCharacters.length < 2) {
      return "Select at least 2 characters";
    }
  
    let synergyCost = 0;
    const relationshipValues = {
      3: 1,  // Love
      2: 2,  // Friendship
      1: 3,  // Liking
      0: 4,  // Indifference
      "-1": 5, // Displeasure
      "-2": 6, // Hostility
      "-3": 7  // Hatred
    };
  
    for (let i = 0; i < this.data.selectedCharacters.length; i++) {
      for (let j = i + 1; j < this.data.selectedCharacters.length; j++) {
        const char1 = game.actors.getName(this.data.selectedCharacters[i]);
        const char2 = game.actors.getName(this.data.selectedCharacters[j]);
  
        if (char1 && char2) {
          const relation1 = char1.system.relationships.find(r => r.characterName === char2.name);
          const relation2 = char2.system.relationships.find(r => r.characterName === char1.name);
  
          console.log(`Relation between ${char1.name} and ${char2.name}:`, relation1, relation2);
  
          // Convertir relationshipLevel en nombre et l'utiliser comme clé pour relationshipValues
          const cost1 = relationshipValues[Number(relation1?.relationshipLevel)] || 4;
          const cost2 = relationshipValues[Number(relation2?.relationshipLevel)] || 4;
  
          console.log(`Costs: ${cost1}, ${cost2}`);
  
          synergyCost += cost1 + cost2;
  
          // Appliquer la réduction si les relations sont identiques et positives
          if (relation1?.relationshipLevel === relation2?.relationshipLevel &&
              [3, 2, 1].includes(Number(relation1?.relationshipLevel))) {
            synergyCost -= 2;
            console.log("Applied discount for matching positive relationships");
          }
        }
      }
    }
  
    console.log("Final calculated synergy cost:", synergyCost);
    return Math.max(1, synergyCost);
  }
  


  _onCharacterSelect(event) {
    const characterName = event.currentTarget.dataset.character;
    const index = this.data.selectedCharacters.indexOf(characterName);
    if (index > -1) {
      this.data.selectedCharacters.splice(index, 1);
    } else {
      this.data.selectedCharacters.push(characterName);
    }
    this.updateManeuverCost();
    this.render(false);
  }

toggleMemberSelection(characterName) {
  const index = this.data.selectedCharacters.indexOf(characterName);
  if (index > -1) {
    this.data.selectedCharacters.splice(index, 1);
  } else {
    this.data.selectedCharacters.push(characterName);
  }
  this.updateCharacterSelectionVisuals();
  this.updateManeuverCost();
  this.render(false);
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

Hooks.on('updateActor', (actor, changes, options, userId) => {
  if ('system.relationships' in changes) {
    for (let tracker of Object.values(game.weaveOfEchoes.additionalTrackers)) {
      tracker.updateSynergyBasedOnRelationships(actor);
    }
  }
});