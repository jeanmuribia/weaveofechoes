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
  
    // Log the selected characters for debugging
    console.log('Selected Characters in Synergy Tracker:', this.data.selectedCharacters);
  
    // Trigger hook for focus tracker to update
    Hooks.call('updateSynergyGroup', this);
  
    // Re-render tracker to reflect changes
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
  Hooks.call('updateSynergyGroup', this);
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

  // Ajouter temporairement les membres au groupe
  this.data.characters.push(...selectedMembers);

  // Vérification stricte des relations après ajout temporaire
  let missingTies = [];
  for (let i = 0; i < this.data.characters.length; i++) {
    for (let j = i + 1; j < this.data.characters.length; j++) {
      const memberA = this.data.characters[i];
      const memberB = this.data.characters[j];

      const actorA = game.actors.getName(memberA);
      const actorB = game.actors.getName(memberB);

      // Initialiser les relations si elles sont manquantes
      actorA.system.relationships = actorA.system.relationships || [];
      actorB.system.relationships = actorB.system.relationships || [];

      // Vérification de la relation mutuelle entre les personnages
      const relationA = actorA.system.relationships.find(r => r.characterName === memberB);
      const relationB = actorB.system.relationships.find(r => r.characterName === memberA);

      if (!relationA || !relationB) {
        missingTies.push(`${memberA} and ${memberB}`);
      }
    }
  }

  if (missingTies.length > 0) {
    // Retirer les membres ajoutés temporairement et afficher un avertissement détaillé
    this.data.characters = this.data.characters.filter(member => !selectedMembers.includes(member));
    ui.notifications.warn(`No ties between: ${missingTies.join(', ')}`);
    this._updateTracker();
  } else {
    // Ajouter les membres à la liste globale des membres assignés
    selectedMembers.forEach(member => SynergyTracker.assignedMembers.add(member));
    this.data.maxSynergy = this.calculateMaxSynergy();
    this._updateTracker();
  }

  Hooks.call('updateSynergyGroup', this);
}
a

  updateGroupMembers(html) {
    const selectedMembers = Array.from(html.find('input[name="group-member"]:checked'))
      .map(input => game.actors.get(input.value).name);
    
    this.data.characters = selectedMembers;
    this.data.selectedCharacters = [];
    this.initializeSynergy();
    this._updateTracker();
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
      this._updateTracker();
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