import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { BiographySystem } from '../biography-system.js';


// Helper function to capitalize the first letter of a string
function toUpperCaseValue(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Register Handlebars helper for uppercase transformation
Handlebars.registerHelper('toUpperCaseValue', function(value) {
  if (typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
});

Handlebars.registerHelper('firstLetter', function(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase();
});

Handlebars.registerHelper('ne', function(a, b) {
  return a !== b;
});

// Handle actor deletion and remove associated relationships
Hooks.on("preDeleteActor", async (actor, options, userId) => {
  const deletedActorName = actor.name;

  // Loop through all other actors and remove the deleted character from their relationships
  for (let otherActor of game.actors.filter(a => a.id !== actor.id && a.type === "character")) {
      const relationships = foundry.utils.duplicate(otherActor.system.relationships || []);
      const updatedRelationships = relationships.filter(rel => rel.characterName !== deletedActorName);

      // If relationships were updated, save the change
      if (relationships.length !== updatedRelationships.length) {
          await otherActor.update({ 'system.relationships': updatedRelationships });
      }
  }
});



export class WoeActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
    this.selectedAttribute = null;
    this.selectedTemper = null;
    this.selectedContext = null;
    this.selectedMembers = [];
    this.maneuverCost = null;
    this.maneuverSelections = {
      attribute: null,
      temper: null,
      context: null
  };

    Hooks.on('synergyVisibilityChanged', (actor, isHidden) => {
      if (actor.id === this.actor.id) {
        this.render(false);
      }
    });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['weave-of-echoes', 'sheet', 'actor'],
      width:1100,
      height: 1300,
      tabs: [
        { navSelector: '.sheet-tabs', contentSelector: '.tab-content', initial: 'profile' },
      ],
    });
  }

  get template() {
    return `systems/weave_of_echoes/templates/actor/actor-character-sheet.hbs`;
  }

  async getData() {
    
  
    // Obtenez le contexte de base
    const context = await super.getData();
  
    // Initialisez les structures de données nécessaires si elles n'existent pas
    const actorData = this.actor.toObject(false);
  
    // Assurez-vous que `system` existe
    actorData.system = actorData.system || {};
  
    // Stamina
    actorData.system.stamina = actorData.system.stamina || {
      max: 4,
      current: 4
    };
  
    // Focus Points
    actorData.system.focusPoints = actorData.system.focusPoints || {
      base: 0,
      current: 0,
      isVisible: false
    };
  
    // Tempers
    actorData.system.tempers = actorData.system.tempers || {};
    ['passion', 'empathy', 'rigor', 'independence'].forEach(temper => {
      actorData.system.tempers[temper] = actorData.system.tempers[temper] || {
        baseValue: 'neutral',
        currentValue: 'neutral',
        injury: false
      };
    });
  
    // Attributes
    actorData.system.attributes = actorData.system.attributes || {};
    ['body', 'martial', 'soul', 'elementary', 'mind', 'rhetoric'].forEach((attr, index) => {
      actorData.system.attributes[attr] = actorData.system.attributes[attr] || {
        baseValue: 'neutral',
        currentValue: 'neutral',
        injury: false,
        order: index + 1,
        tag1: '',
        tag2: '',
        tag3: ''
      };
    });
  
    // Wounds
    actorData.system.wounds = actorData.system.wounds || {
      wound1: false,
      wound2: false,
      wound3: false,
      knockedOut: false
    };
  
    // Mastery
    actorData.system.masteryLevel = actorData.system.masteryLevel || 0;
    actorData.system.masteryPoints = actorData.system.masteryPoints || 0;
  
    // Relationships
 
    actorData.system.relationships = actorData.system.relationships || {
      connections: []
    };
    actorData.system.relationships.connections = Array.isArray(actorData.system.relationships.connections)
      ? actorData.system.relationships.connections
      : [];
  
      // Goup Info
      context.currentGroup = this.actor.system.relationships.currentGroup;
      context.personalGroup = this.actor.system.relationships.characterGroup;

      // Récupérer les informations de groupe
  const groupInfo = await this.getGroupInfoFromCharacterId(this.actor.id);

  context.groupSynergy = {
    members: groupInfo?.members || [],
    currentGroupSynergy: groupInfo?.currentGroupSynergy || 0,
    missingTies: groupInfo?.missingTies || [],
  };

    //valeurs d'affinity et de dynamic au contexte
    // Ajouter les valeurs d'affinity et de dynamic au contexte
    context.AFFINITY_VALUES = {
      1: "Enemy",
      2: "Acquaintance",
      3: "Friend",
      4: "Soulmate",
    };
  
    context.DYNAMIC_VALUES = {
      0.4: "Equal",
      0.5: "Rival",
      0.75: "Inferior",
      0.85: "Superior",
    };
  

    // Biography
    actorData.system.biography = actorData.system.biography || {
      entries: []
    };
    actorData.system.biography.entries = Array.isArray(actorData.system.biography.entries)
      ? actorData.system.biography.entries
      : [];
  
    // Mise à jour des relations avec les images
    actorData.system.relationships.connections = actorData.system.relationships.connections.map(conn => {
      const relatedActor = game.actors.get(conn.characterId);
      return {
        ...conn,
        img: relatedActor?.img || "icons/svg/mystery-man.svg",
        playerName: relatedActor?.owner?.name || "Unknown"
      };
    });
  
    // Ajouter les acteurs disponibles pour de nouvelles relations
    context.actors = game.actors.filter(actor =>
      actor.id !== this.actor.id &&
      actor.type === "character" &&
      !actorData.system.relationships.connections.some(conn => conn.characterId === actor.id)
    );
  
    // Intégrer les données mises à jour dans le contexte
    context.actorData = actorData; // Toutes les données complètes de l'acteur
    context.system = actorData.system;
    context.actorName = this.actor.name;
  
    return context;
  }
  
  async rollDie(type) {
    if (!type) return "undefined";

    type = type.toLowerCase();
    const roll = await Roll.create("1d12").evaluate({async: false}); // Nouvelle syntaxe

    let result;
    switch (type) {
        case 'malus':
            result = (roll.total <= 7) ? "Setback" : (roll.total <= 11) ? "Nothing" : "Gain";
            break;
        case 'neutral':
            result = (roll.total <= 3) ? "Setback" : (roll.total <= 9) ? "Nothing" : "Gain";
            break;
        case 'bonus':
            result = (roll.total <= 2) ? "Setback" : (roll.total <= 7) ? "Nothing" : "Gain";
            break;
        case 'critical':
            result = (roll.total == 1) ? "Setback" : (roll.total <= 5) ? "Nothing" : "Gain";
            break;
        default:
            result = "undefined";
    }

    return result;
}

formatResult(result) {
    switch (result) {
        case "Gain":
            return `<span class="result-gain"><strong>${result}</strong></span>`;
        case "Setback":
            return `<span class="result-setback"><strong>${result}</strong></span>`;
        default:
            return result; // Aucun changement pour "Nothing"
    }
    
}



getColorForValue(value) {
  const colors = {
      critical: "gold",
      bonus: "green",
      neutral: "blue",
      malus: "red"
  };
  return colors[value] || "gray";
}
  

_prepareFocusPointsData(context) {
  // S'assurer que context.system existe
  if (!context.system) {
    context.system = {};
  }

  // S'assurer que focusPoints existe avec des valeurs par défaut
  if (!context.system.focusPoints) {
    context.system.focusPoints = {
      base: 0,
      current: 0,
      isVisible: false
    };
  }

  // Rendre les données disponibles dans le contexte
  context.focusPoints = context.system.focusPoints;

  return context;
}
  // Activate Listeners for sheet interactions
  activateListeners(html) {
    super.activateListeners(html);
  
    // Handle name editing
    this.handleNameEditing(html);
  
    // Profile image editing
    this.handleProfileImageEditing(html);
  
    // Stamina editing
    this.handleStaminaEditing(html);
    this.handleStaminaMaxEditing(html);


  
    // Element editing
    this.handleElementEditing(html);
  
    // Focus handling
    this.handleFocusToggle(html);
    this.handleFocusEditing(html);
  
    // Card editing
    html.find('.edit-button').on('click', (event) => {
      this.handleCardEdit(event, html);
    });

    html.find('.base-value-indicator').on('click', (event) => {
      this.handleCardEdit(event, html);
    });

    html.find('.attribute-tag-field').on('change', this._onTagChange.bind(this));
  
    // Focus points visibility
    html.find('input[name="system.focusPoints.isVisible"]').change(this._onFocusPointsVisibilityChange.bind(this));
    html.find('.focus-add').click(this._onAddFocusPoints.bind(this));
    html.find('.focus-subtract').click(this._onSubtractFocusPoints.bind(this));
    
 
    html.find('.add-relationship').click(async (event) => {
      event.preventDefault();
      await this._onAddRelationship(event);
    });
  

    html.find('input[name^="affinity-"]').on('change', async (event) => {
      const index = event.currentTarget.name.split('-')[1];
      const newValue = parseInt(event.currentTarget.value);
      
      // Récupérer les connections actuelles
      const connections = [...this.actor.system.relationships.connections];
      
      // Mettre à jour l'affinity
      connections[index].affinity = {
        value: newValue,
        label: this.actor._getAffinityLabel(newValue)
      };
      
      // Recalculer la relationshipValue
      connections[index].relationshipValue = Math.round(
        newValue * connections[index].dynamic.value
      );
      

      Hooks.on('updateActor', (actor, changes, options, userId) => {
        if (actor.id === this.actor.id && changes.system?.relationships) {
          this.render(false);
        }
      });

      // Mettre à jour l'acteur
      await this.actor.update({
        'system.relationships.connections': connections
      });
    });

    
    // Gérer les changements de Dynamic
    html.find('input[name^="dynamic-"]').on('change', async (event) => {
      const index = event.currentTarget.name.split('-')[1];
      const newValue = parseFloat(event.currentTarget.value);
      
      // Récupérer les connections actuelles
      const connections = [...this.actor.system.relationships.connections];
      
      // Mettre à jour le dynamic
      connections[index].dynamic = {
        value: newValue,
        label: this.actor._getDynamicLabel(newValue)
      };
      
      // Mettre à jour l'acteur
      await this.actor.update({
        'system.relationships.connections': connections
      });
    });
    
    // Gérer la suppression d'une relation
    html.find('.delete-relationship').on('click', async (event) => {
      const card = event.currentTarget.closest('.relationship-card');
      const index = Array.from(card.parentElement.children).indexOf(card);
      
      const connections = [...this.actor.system.relationships.connections];
      connections.splice(index, 1);
      
      await this.actor.update({
        'system.relationships.connections': connections
      });
      await this.updateDiscordLevels();
    });
    
    // Gérer la visibilité d'une relation
    html.find('.visibility-toggle').on('click', async (event) => {
      const card = event.currentTarget.closest('.relationship-card');
      const index = Array.from(card.parentElement.children).indexOf(card);
      
      const connections = [...this.actor.system.relationships.connections];
      connections[index].isHidden = !connections[index].isHidden;
      
      await this.actor.update({
        'system.relationships.connections': connections
      });
      
      // Toggle la classe pour l'affichage visuel
      $(card).toggleClass('hidden-relationship');
    });
    

     // Listener pour Affinity
  html.find('.affinity-selector').on('change', event => {
    const targetIndex = event.currentTarget.dataset.index;
    const newValue = parseInt(event.currentTarget.value); // Convertit la valeur en entier

    this.updateAffinityValue(targetIndex, newValue);
     this.updateDiscordLevels();
  });

  // Listener pour Dynamic
  html.find('.dynamic-selector').on('change', event => {
    const targetIndex = event.currentTarget.dataset.index;
    const newValue = parseFloat(event.currentTarget.value); // Convertit la valeur en float

    this.updateDynamicValue(targetIndex, newValue);
    this.updateDiscordLevels();
  });

    html.find('.notes-edit').on('blur', (event) => {
      const textarea = $(event.currentTarget);
      const newValue = textarea.val(); // Récupérer la valeur du champ
      const index = textarea.closest('.relationship-card').data('index'); // Identifier l'index de la relation
      const path = `system.relationships.connections.${index}.notes`; // Chemin des données
  
      // Mise à jour des données dans l'acteur
      this.actor.update({ [path]: newValue }).then(() => {
        // Revenir en mode affichage après la sauvegarde
        const displayDiv = textarea.siblings('.notes-display');
        displayDiv.text(newValue);
        textarea.addClass('hidden');
        displayDiv.removeClass('hidden');
      });
    });
  
    // Passage au mode édition
    html.find('.notes-display').on('click', (event) => {
      const displayDiv = $(event.currentTarget);
      const textarea = displayDiv.siblings('.notes-edit');
      displayDiv.addClass('hidden');
      textarea.removeClass('hidden').focus();
    });
  

    // Wounds, Injuries, and Trauma management
    this.handleMasteryLevelEditing(html);
    this._setupAttributeListeners(html);
    this._setupWoundListeners(html);

    this.manageTemperTrauma(html);
  
    // Dice rolling
    this.addDiceListeners(html);
  
    // Group management listeners
    html.find('.group-with').on('click', this.handleGroupWith.bind(this));
    html.find('.return-to-my-group').on('click', this.handleReturnToMyGroup.bind(this));

    //Affichage dans le grouo 
    const characterId = this.actor.id;
    this.renderGroupMembers(characterId);
  
    // Maneuver
    html.find('.maneuver-container').on('click', () => { this.openManeuverWindow(); });
  
    // Relationships

   
    html.find('.attribute-tag-field').on('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault(); // Empêche le retour à la ligne
        event.target.blur(); // Simule la fin de l'édition si nécessaire
      }
    });
    

    //Biography
    BiographySystem.setup(html, this.actor);
   
  }


  // Gestion des groupes dans les fiches de perso 

  async getGroupInfo(groupId) {
    const actors = game.actors.contents;
  
    // Parcourir les acteurs pour trouver le groupe correspondant
    for (let actor of actors) {
      if (actor.system.relationships.characterGroup.id === groupId) {
        const groupMembers = actor.system.relationships.characterGroup.members || [];
  
        // Préparer les informations des membres
        const memberInfo = groupMembers.map(memberId => {
          const memberActor = game.actors.get(memberId);
  
          // Vérifier si l'acteur existe
          if (memberActor) {
            return {
              name: memberActor.name,
              isInOwnGroup: memberActor.system.relationships.characterGroup.isInHisOwnGroup
            };
          }
  
          return null; // En cas d'ID invalide
        }).filter(member => member !== null); // Supprimer les entrées nulles
  
        return {
          id: actor.system.relationships.characterGroup.id,
          name: actor.system.relationships.characterGroup.name,
          members: memberInfo
        };
      }
    }
  
    // Retourner null si aucun groupe n'est trouvé
    return null;

  }
  
  async getGroupInfoFromCharacterId(characterId) {
   
    const characterActor = game.actors.get(characterId);
  
    if (!characterActor) {
      console.error(`L'acteur avec l'ID ${characterId} est introuvable.`);
      return null;
    }
  
    const currentGroupId = characterActor.system.relationships.currentGroup;
    if (!currentGroupId) {
      console.error(`Le personnage avec l'ID ${characterId} n'appartient à aucun groupe.`);
      return null;
    }
  
    const allActors = game.actors.contents;
    const groupOwner = allActors.find(
      actor => actor.system.relationships.characterGroup.id === currentGroupId
    );
  
    if (!groupOwner) {
      console.error(`Aucun groupe trouvé avec l'ID ${currentGroupId}.`);
      return null;
    }
  
    const groupMembers = groupOwner.system.relationships.characterGroup.members || [];
    const validMembers = groupMembers
      .map(memberId => game.actors.get(memberId))
      .filter(memberActor => memberActor);
  
    // Vérifier les connexions manquantes en utilisant la méthode existante
    const missingConnections = await this.checkRelationshipsWithinGroup(characterActor.id);
  
    return {
      groupId: currentGroupId,
      groupName: groupOwner.system.relationships.characterGroup.name,
      members: validMembers,
      currentGroupSynergy: groupOwner.system.relationships.currentGroupSynergy || 0,
      baseGroupSynergy: groupOwner.system.relationships.baseGroupSynergy || 0,
      missingTies: missingConnections || [],
    };
  }
  
  
  renderGroupSynergy(groupData) {
  
    // Vérification de la validité des données
    if (!groupData || !groupData.members) {
      console.warn("Données de groupe invalides ou membres absents.");
      return `
        <div class="synergy-message">
          No members in the group yet.
        </div>
      `;
    }
  
    if (groupData.members.length < 3) {
      console.warn("Le groupe contient moins de 3 membres.");
      return `
        <div class="synergy-message">
          No members in the group yet.
        </div>
      `;
    }
  
    const { currentGroupSynergy = 0, missingTies = [] } = groupData;
  
    // Affichage basé sur l'état du groupe
    if (missingTies.length > 0) {
      console.warn("Des connexions sont manquantes dans le groupe.");
      return `
        <div class="synergy-container">
          <div class="missing-ties">
            <h4>Missing Ties:</h4>
            <ul>
              ${missingTies.map(tie => `<li>${tie.from} ➡️ ${tie.to}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (currentGroupSynergy > 0) {
      return `
        <div class="synergy-container">
          <div class="synergy-value">
            Current Synergy: ${currentGroupSynergy}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="synergy-container">
          <div class="synergy-message">
            Unable to calculate synergy. Check group configuration.
          </div>
        </div>
      `;
    }
    
  }
  
  
  async renderGroupMembers(characterId) {
    // Récupérer les informations du groupe via la fonction existante
    const groupInfo = await this.getGroupInfoFromCharacterId(characterId);
  
    // Vérifier que le groupe existe
    if (!groupInfo) {
      console.error("Impossible de récupérer les informations du groupe.");
      return;
    }
  
    // Exclure le personnage actuel
    const currentCharacter = game.actors.get(characterId);
    const members = groupInfo.members.filter(member => member.name !== currentCharacter.name);
  
    // Sélectionner les éléments HTML nécessaires
    const container = this.element.find(".members-list");
    const noMembersMessage = this.element.find(".no-members");
  
    // Vérifier s'il y a des membres
    if (members.length > 0) {
      noMembersMessage.hide(); // Masquer le message "No members in this group yet."
      container.empty(); // Nettoyer la liste des membres avant d'ajouter les nouveaux
  
      // Ajouter les avatars et noms des membres
      members.forEach(member => {
        const actor = game.actors.getName(member.name);
        const avatar = actor?.img || "path/to/default-avatar.png";
  
        // Créer un élément de liste pour chaque membre
        const memberElement = $(`
          <li class="member">
            <img src="${avatar}" alt="${member.name}" class="member-avatar" />
            <span class="member-name">${member.name}</span>
          </li>
        `);
  
        container.append(memberElement);
      });
    } else {
      // Si aucun membre, afficher le message par défaut
      noMembersMessage.show();
      container.empty(); // Nettoyer la liste des membres
    }
  }  

  async changeGroup(newGroupId) {
    try {
      const currentGroupId = this.system.relationships.currentGroup;
  
      if (currentGroupId === newGroupId) {
        return;
      }
  
      const newGroupOwner = game.actors.find(actor =>
        actor.system.relationships.characterGroup.id === newGroupId
      );
  
      if (newGroupOwner) {
        const newMembers = [...newGroupOwner.system.relationships.characterGroup.members];
        if (!newMembers.includes(this.id)) {
          newMembers.push(this.id);
          await newGroupOwner.update({
            'system.relationships.characterGroup.members': newMembers
          });
        }
      }
  
      // Si on retourne dans notre propre groupe, s'assurer qu'il existe encore
      if (newGroupId === this.system.relationships.characterGroup.id) {
        console.log(`🔄 [RETURN] ${this.name} retourne dans son propre groupe.`);
        
        // Vérifier si le groupe personnel a été vidé
        if (this.system.relationships.characterGroup.members.length <= 1) {
          console.log(`⚠️ [WARNING] Le groupe de ${this.name} était vide. Restauration en cours...`);
          
          // Restaurer le ghost_member
          this.system.relationships.characterGroup.members = [this.id, "ghost_member"];
  
          await this.update({
            'system.relationships.characterGroup.members': this.system.relationships.characterGroup.members
          });
  
          console.log(`✅ [FIXED] Groupe restauré pour ${this.name}.`);
        }
      }

      // 🔄 Sauvegarde du groupe personnel AVANT de quitter
if (this.system.relationships.characterGroup.id) {
  console.log(`💾 [SAVE] Sauvegarde du groupe personnel de "${this.name}" avant changement.`);
  
  await this.update({
      'system.relationships.characterGroup': this.system.relationships.characterGroup
  }).then(() => {
      console.log(`✅ [SAVED] Groupe personnel de "${this.name}" sauvegardé.`);
  }).catch(err => {
      console.error(`❌ [ERROR] Impossible de sauvegarder le groupe personnel de "${this.name}"`, err);
  });
}
  
      await this.update({
        'system.relationships.currentGroup': newGroupId,
        'system.relationships.characterGroup.isInHisOwnGroup': newGroupId === this.system.relationships.characterGroup.id
      });
  
      console.log(`🔍 [DEBUG] Avant MAJ ancien groupe - ID: ${currentGroupId}`, oldGroupOwner?.system.relationships.characterGroup);

      if (currentGroupId) {
        const oldGroupOwner = game.actors.find(actor =>
          actor.system.relationships.characterGroup.id === currentGroupId
        );
  
        if (oldGroupOwner) {
          let oldMembers = [...oldGroupOwner.system.relationships.characterGroup.members];
          const updatedMembers = oldMembers.filter(memberId => memberId !== this.id);
  
          // Si le tableau est vide, ajoute une valeur par défaut
          if (updatedMembers.length === 0) {
            updatedMembers.push("ghost_member");
            console.log(`👻 [GHOST] Le ghost_member a été rajouté au groupe ${oldGroupOwner.name}.`);
          }
  
          await oldGroupOwner.update({
            'system.relationships.characterGroup.members': updatedMembers
          });
        }
      }

  console.log(`👻 [CHECK] Groupe personnel après retour de "${this.name}"`, this.system.relationships.characterGroup);
      this.render(false);
  
    } catch (error) {
      console.error('❌ Erreur lors du changement de groupe :', error);
      ui.notifications.error('Une erreur est survenue lors du changement de groupe');
    }
  }
  
  async checkRelationshipsWithinGroup(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      console.error(`L'acteur avec l'ID ${actorId} est introuvable.`);
      return;
    }
  
    const groupId = actor.system.relationships.currentGroup;
    if (!groupId) {
      console.error(`L'acteur ${actor.name} n'appartient à aucun groupe.`);
      return;
    }
  
    const groupInfo = await actor.sheet.getGroupInfo(groupId);
    if (!groupInfo || groupInfo.members.length === 0) {
      console.error(`Le groupe ${groupId} est vide ou introuvable.`);
      return;
    }
  
    const missingConnections = [];
    for (const member of groupInfo.members) {
      const memberActor = game.actors.getName(member.name);
      if (!memberActor) continue;
  
      for (const otherMember of groupInfo.members) {
        if (member.name === otherMember.name) continue;
        
        // Vérifier si la connexion existe dans les relations
        const hasConnection = memberActor.system.relationships.connections.some(
          conn => conn.characterName === otherMember.name // Changé de 'target' à 'characterName'
        );
  
        if (!hasConnection) {
          missingConnections.push({
            from: member.name,
            to: otherMember.name,
          });
        }
      }
    }
  
    return missingConnections; // Ajout du return pour que la fonction retourne les connexions manquantes
  }

  async calculateGroupSynergy(actorId) {
    // Placeholder : Les valeurs seront calculées plus tard
    return {
      baseGroupSynergy: Math.floor(Math.random() * 100), // Valeur aléatoire
      currentGroupSynergy: Math.floor(Math.random() * 100), // Valeur aléatoire
    };
  }

  renderGroupSynergy(groupData) {
    console.log("Group Data reçu :", groupData); // Debug log
  
    // Vérification du groupe et des membres
    if (!groupData || !groupData.members) {
      return `
        <div class="synergy-message">
          No members in the group yet.
        </div>
      `;
    }
  
    if (groupData.members.length < 3) {
      return `
        <div class="synergy-message">
          No members in the group yet.
        </div>
      `;
    }
  
    const { currentGroupSynergy = "N/A", missingTies = [] } = groupData;
  
    console.log("Group Data reçu dans renderGroupSynergy:", groupData);
    // Afficher les missing ties s'il y en a
    const missingTiesHtml = missingTies.length > 0
      ? `
        <div class="missing-ties">
          <h4>Missing Ties:</h4>
          <ul>
            ${missingTies.map(tie => `<li>${tie.from} ➡️ ${tie.to}</li>`).join('')}
          </ul>
        </div>
      `
      : `
        <div class="missing-ties">
          All group members are connected.
        </div>
      `;
  
    return `
      <div class="synergy-container">
        <div class="synergy-value">
          Current Synergy: ${currentGroupSynergy}
        </div>
        ${missingTiesHtml}
      </div>
    `;
  }
  
  async updateAffinityValue(index, newValue) {
    const connections = [...this.actor.system.relationships.connections];
    if (connections[index]) {
      connections[index].affinity.value = newValue;
      // Calculer immédiatement la nouvelle discordValue
      const dynamicValue = parseFloat(connections[index].dynamic.value) || 0.4;
      connections[index].discordValue = Math.round((newValue * dynamicValue) * 100) / 100;
      
      await this.actor.update({
        "system.relationships.connections": connections,
        'system.relationships.allConnectionsDiscordValue': totalDiscordLevel
      });
      
      console.log('Updated Discord Value:', connections[index].discordValue);
    }
  }

  async updateDynamicValue(index, newValue) {
    const connections = [...this.actor.system.relationships.connections];
    if (connections[index]) {
      connections[index].dynamic.value = newValue;
      // Calculer immédiatement la nouvelle discordValue
      const affinityValue = parseFloat(connections[index].affinity.value) || 1;
      connections[index].discordValue = Math.round((affinityValue * newValue) * 100) / 100;
      
      await this.actor.update({
        "system.relationships.connections": connections,
      });
      this.calculateDiscordLevel,
      
      console.log('Updated Discord Value:', connections[index].discordValue);
    }
  }

  calculateDiscordValue() {
    const connections = this.actor.system.relationships.connections;
    connections.forEach(connection => {
      const affinityValue = Number(connection.affinity.value);
      const dynamicValue = Number(connection.dynamic.value);
      console.log('Raw values:', { affinity: connection.affinity.value, dynamic: connection.dynamic.value });
      console.log('Parsed values:', { affinityValue, dynamicValue });
      connection.discordValue = Math.round((affinityValue * dynamicValue) * 100) / 100;
    });
  }

  async updateDiscordLevels() {
  const connections = this.actor.system.relationships.connections;
  const totalDiscord = connections.reduce((sum, connection) => {
    // On arrondit d'abord chaque Discord Value individuelle
    const discordValue = Math.round(connection.affinity.value * connection.dynamic.value);
    return sum + discordValue;
  }, 0);
  
  await this.actor.update({
    "system.relationships.allConnectionsDiscordValue": totalDiscord
  });
}
async calculateBaseGroupSynergy() {
  const groupMembers = await this.getGroupMembers();
  const memberCount = groupMembers.length;
  const baseGroupSynergy = 10 + (memberCount * memberCount);
  const totalDiscordLevels = groupMembers.reduce((sum, member) => 
    sum + (member.system.relationships.allConnectionsDiscordValue || 0), 0);
  
  await this.actor.update({
    "system.relationships.characterGroup.baseGroupSynergy": Math.max(0, baseGroupSynergy - totalDiscordLevels)
  });
 }
 

  async handleGroupWith() {
    // Récupérer tous les acteurs
const actors = game.actors;

// Récupérer les IDs de son propre groupe et du groupe actuel
const ownGroupId = this.actor.system.relationships.characterGroup.id;
const currentGroupId = this.actor.system.relationships.currentGroup;
const isInOwnGroup = this.actor.system.relationships.characterGroup.isInHisOwnGroup;

// Récupérer tous les groupes disponibles avec les filtres
const availableGroups = [];
for (let actor of actors) {
    if (!actor.system.relationships.characterGroup) continue;

    console.log(`📌 [GROUP CHECK] Groupes détectés :`, availableGroups);
    const group = actor.system.relationships.characterGroup;

    // 🔥 Condition ajoutée : Si le perso n'est pas dans son propre groupe, il ne peut pas rejoindre son groupe personnel
    if (
        group.id !== currentGroupId && 
        group.members.length > 1 && 
        (isInOwnGroup || group.id !== ownGroupId) // 🔥 Ajout ici
    ) {
        availableGroups.push({
            id: group.id,
            name: group.name,
            members: group.members,
            leader: group.members[0] // On considère le premier membre comme leader
        });
    }
}

// Vérifier s'il y a des groupes disponibles
if (availableGroups.length === 0) {
    ui.notifications.warn("No group available");
    return;
}
  
    // Créer et afficher la dialog
    const dialog = new Dialog({
      title: "Join a Group",
      content: `
      <form>
        <div class="available-groups-grid">
          ${availableGroups.map(group => {
            const leader = game.actors.get(group.leader);
            const members = group.members.map(id => game.actors.get(id)).filter(Boolean);
  
            return `
              <div class="group-card" data-group-id="${group.id}">
                <div class="group-header">
                  <h3>${group.name}</h3>
                </div>
                <div class="group-members-avatars">
                  ${members.map(member => `
                    <div class="member-avatar" title="${member.name}">
                      <img src="${member.img}" alt="${member.name}"/>
                    </div>
                  `).join('')}
                </div>
                <button class="join-group-btn" type="button" data-group-id="${group.id}">
                  Join Group
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </form>
  
      <style>
        .available-groups-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 1rem;
        }
  
        .group-card {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 180px;
        }
  
        .group-header h3 {
          margin: 0;
          font-size: 1.2em;
        }
  
        .group-members-avatars {
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1;
          margin: 1rem 0;
        }
  
        .member-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #4b4b4b;
        }
  
        .member-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
  
        .join-group-btn {
          background: #4b4b4b;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
        }
  
        .join-group-btn:hover {
          background: #666;
        }
      </style>
      `,
      buttons: {
        close: {
          label: "Close"
        }
      },
      render: (html) => {
        html.on('click', '.join-group-btn', async (event) => {
          const groupId = event.currentTarget.dataset.groupId;
  
          try {
            // Utiliser directement this.actor qui est l'instance de WoeActor
            await game.actors.get(this.actor.id).changeGroup(groupId);
  
            const targetGroupActor = game.actors.find(a =>
              a.system.relationships.characterGroup?.id === groupId
            );
  
            if (targetGroupActor) {
              ui.notifications.info(
                `${this.actor.name} a rejoint "${targetGroupActor.system.relationships.characterGroup.name}"`
              );
            }
  
            dialog.close();
          } catch (error) {
            console.error("Erreur lors du changement de groupe:", error);
            ui.notifications.error("Impossible de rejoindre le groupe");
          }
        });
      }
    });
  
    dialog.render(true);
  }
   
  async handleReturnToMyGroup() {
    try {
        console.log(`🔄 [DEBUG] ${this.actor.name} retourne dans son groupe personnel.`);

        // Vérifier si `relationships` existe
        if (!this.actor.system.relationships) {
            console.error(`❌ [ERROR] relationships est introuvable pour "${this.actor.name}" !`);
            return ui.notifications.error(`Erreur : Impossible de récupérer les relations du personnage.`);
        }

        const currentGroupId = this.actor.system.relationships.currentGroup;
        const personalGroup = this.actor.system.relationships.characterGroup;

        // Vérifier si le groupe personnel existe
        if (!personalGroup || !personalGroup.id) {
            console.error(`❌ [ERROR] "${this.actor.name}" n'a pas de groupe personnel valide.`);
            return ui.notifications.error(`Erreur : Impossible de retourner dans le groupe personnel.`);
        }

        console.log(`📌 [DEBUG] Groupe actuel:`, currentGroupId);
        console.log(`👥 [DEBUG] Groupe personnel:`, personalGroup);

        // Retirer l'acteur de son groupe actuel s'il en a un
        if (currentGroupId && currentGroupId !== personalGroup.id) {
            const oldGroupOwner = game.actors.find(actor =>
                actor.system.relationships.characterGroup.id === currentGroupId
            );

            if (oldGroupOwner) {
                let oldMembers = [...oldGroupOwner.system.relationships.characterGroup.members];
                oldMembers = oldMembers.filter(memberId => memberId !== this.actor.id);

                if (oldMembers.length === 0) {
                    oldMembers.push("ghost_member");
                }

                await oldGroupOwner.update({
                    "system.relationships.characterGroup.members": oldMembers
                });

                console.log(`❌ [DEBUG] "${this.actor.name}" retiré du groupe "${currentGroupId}".`);
            }
        }

        // Vérifier si l'acteur est bien listé dans son propre groupe
        if (!personalGroup.members.includes(this.actor.id)) {
            console.log(`➕ [FIX] Ajout de "${this.actor.name}" à son propre groupe.`);
            personalGroup.members.push(this.actor.id);
        }

        // Mise à jour de l'actor
        await this.actor.update({
            "system.relationships.currentGroup": personalGroup.id,
            "system.relationships.characterGroup.members": personalGroup.members,
            "system.relationships.characterGroup.isInHisOwnGroup": true
        });

        console.log(`✅ [SUCCESS] "${this.actor.name}" est retourné dans son groupe personnel.`);
        ui.notifications.info(`${this.actor.name} est retourné dans son groupe personnel.`);

    } catch (error) {
        console.error(`❌ [ERROR] Une erreur est survenue lors du retour au groupe personnel:`, error);
        ui.notifications.error(`Une erreur est survenue lors du retour au groupe personnel.`);
    }
}


  rollTemperOrAttribute(field, type) {
    let value;
  
    // Get the current value from the temper or attribute
    if (type === 'tempers') {
      value = this.actor.system.tempers[field].currentValue;
    } else if (type === 'attributes') {
      value = this.actor.system.attributes[field].currentValue;
    }
  
  
    // Roll the die with the current value (like 'malus', 'neutral', etc.)
    this.handleSingleDiceRoll(value);  // Use "this" to reference the method correctly
  }

   // Method to handle the dice rolling
  async handleSingleDiceRoll(type) {
    const capitalizedType = toUpperCaseValue(type);
    const result = await rollDie(type);
    this.displayRollResultsInChat(capitalizedType, result);
  }

  // Display the roll result in the chat
  displayRollResultsInChat(capitalizedType, result) {
    ChatMessage.create({
      content: `${capitalizedType} rolled: ${result}`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  // Function to set up attribute listeners for injuries
  async _setupAttributeListeners(html) {
    const attributes = ['body', 'mind', 'soul', 'martial', 'elementary', 'rhetoric'];
    
    attributes.forEach(attr => {
      const injuryCheckbox = html.find(`#${attr}-injury`);
      const baseValue = this.actor.system.attributes[attr].baseValue;
  
      // Configuration initiale pour Malus
      if (baseValue === 'malus') {
        injuryCheckbox.prop('disabled', true)
                      .parent().addClass('disabled')
                      .attr('title', "Malus attribute can't get injured");
        return;
      }
  
      injuryCheckbox.on('click', async event => {
        const isChecked = event.currentTarget.checked;
        const updates = {
          [`system.attributes.${attr}.injury`]: isChecked
        };
  
        if (!isChecked) {
          // Si l'injury est enlevée, il faut calculer la current value basée sur les wounds
          const wounds = Object.values(this.actor.system.wounds).filter(w => w).length;
          let newValue = baseValue;
          for(let i = 0; i < wounds; i++) {
            newValue = this._degradeValue(newValue);
          }
          updates[`system.attributes.${attr}.currentValue`] = newValue;
        } else {
          updates[`system.attributes.${attr}.currentValue`] = 'malus';
        }
  
        await this.actor.update(updates);
        this.render();
      });
    });
  }
  

  _setupWoundListeners(html) {
    ['1', '2', '3', 'knockedOut'].forEach(number => {
      const woundBox = html.find(`.wound-box[data-wound="${number}"]`);
      if (number === 'knockedOut') {
        woundBox.on('click', () => this._handleKnockedOut());
      } else {
        woundBox.on('click', () => this._handleWoundClick(number));
      }
    });
  }
  
  async _handleKnockedOut() {
    // Toggle le knockedOut
    const isKnockedOut = this.actor.system.wounds.knockedOut;
    await this.actor.update({
      'system.wounds.knockedOut': !isKnockedOut
    });
  }
  
  _handleWoundClick(number) {
    const wounds = this.actor.system.wounds;
    const attributes = this.actor.system.attributes;
    const isActivating = !wounds[`wound${number}`]; // true si on active la wound
    
    const updates = {
      [`system.wounds.wound${number}`]: isActivating
    };
  
    // Pour chaque attribut, mettre à jour la current value SI PAS INJURED
    Object.entries(attributes).forEach(([key, attr]) => {
      if (!attr.injury) {  
        let newValue = attr.baseValue;
        let activeWounds = 0;
        
        // Compter les wounds actives en incluant celle qu'on est en train de modifier
        Object.entries(wounds).forEach(([woundKey, isActive]) => {
          if (woundKey.startsWith('wound') && (woundKey === `wound${number}` ? isActivating : isActive)) {
            activeWounds++;
          }
        });
  
        // Dégrader la valeur en fonction du nombre de wounds actives
        for(let i = 0; i < activeWounds; i++) {
          newValue = this._degradeValue(newValue);
        }
        
        updates[`system.attributes.${key}.currentValue`] = newValue;
      }
    });
  
    this.actor.update(updates);
  }
  _canInteractWithWound(number, wounds) {
    if (wounds[`wound${number}`]) {
      // Pour untick
      return (number === '3' || 
             (number === '2' && !wounds.wound3) || 
             (number === '1' && !wounds.wound2));
    } else {
      // Pour tick
      return (number === '1' || 
             (number === '2' && wounds.wound1) || 
             (number === '3' && wounds.wound2));
    }
  }
  

  
  _degradeValue(value) {
    const values = ['critical', 'bonus', 'neutral', 'malus'];
    const currentIndex = values.indexOf(value);
    return values[Math.min(currentIndex + 1, values.length - 1)];
  }
  
  _improveValue(currentValue, baseValue) {
    const values = ['critical', 'bonus', 'neutral', 'malus'];
    const currentIndex = values.indexOf(currentValue);
    const baseIndex = values.indexOf(baseValue);
    
    // On ne peut pas améliorer au-delà de la baseValue
    const targetIndex = Math.max(currentIndex - 1, 0);
    return values[Math.min(targetIndex, baseIndex)];
  }
  
  _canToggleWound(number) {
    const wounds = this.actor.system.wounds;
    const attributes = this.actor.system.attributes;
    
    // Pour tick
    if (!wounds[`wound${number}`]) {
      if (number === '1') return true;
      if (number === '2') return wounds.wound1;
      if (number === '3') return wounds.wound2;
      return false;
    }
    
    // Pour untick (ordre inverse obligatoire)
    if (number === '3') return true;
    if (number === '2') return !wounds.wound3;
    if (number === '1') return !wounds.wound2;
    return false;
  }
  
  async _tickWound(number) {
    // D'abord, on tick la wound
    await this.actor.update({[`system.wounds.wound${number}`]: true});
    
    // Ensuite, on dégrade tous les attributs non-malus d'un niveau
    const updates = {};
    Object.entries(this.actor.system.attributes).forEach(([key, attr]) => {
      if (attr.currentValue !== 'malus') {
        updates[`system.attributes.${key}.currentValue`] = this._degradeValue(attr.currentValue);
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }
  }
  
  async _untickWound(number) {
    // D'abord, on untick la wound
    await this.actor.update({[`system.wounds.wound${number}`]: false});
    
    // Ensuite, on améliore tous les attributs dont la baseValue n'est pas malus
    const updates = {};
    Object.entries(this.actor.system.attributes).forEach(([key, attr]) => {
      if (attr.baseValue !== 'malus') {
        updates[`system.attributes.${key}.currentValue`] = this._improveValue(attr.currentValue, attr.baseValue);
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }
  }
  
  _degradeValue(value) {
    const values = ['critical', 'bonus', 'neutral', 'malus'];
    const currentIndex = values.indexOf(value);
    return values[Math.min(currentIndex + 1, values.length - 1)];
  }
  
  _improveValue(currentValue, baseValue) {
    const values = ['critical', 'bonus', 'neutral', 'malus'];
    const targetIndex = values.indexOf(baseValue);
    const currentIndex = values.indexOf(currentValue);
    return values[Math.max(currentIndex - 1, targetIndex)];
  }

  manageTemperTrauma(html) {
    ['passion', 'empathy', 'rigor', 'independence'].forEach(temper => {
      html.find(`#${temper}-trauma`).on('change', async (event) => {
        const isChecked = event.target.checked;
        const temperCard = html.find(`.temper-card[data-field="${temper}"]`);
  
        // Update trauma state
        await this.actor.update({
          [`system.tempers.${temper}.injury`]: isChecked,
          [`system.tempers.${temper}.currentValue`]: isChecked ? 'malus' : this.actor.system.tempers[temper].baseValue
        });
  
        // Visual update
        temperCard.toggleClass('disabled', isChecked);
        
        this.render();
      });
    });
  }

  async _onTagChange(event) {
    const input = event.currentTarget;
    const attribute = input.dataset.attribute;
    const tagNumber = input.dataset.tag;
    const newValue = input.value;
  
    await this.actor.update({
      [`system.attributes.${attribute}.tag${tagNumber}`]: newValue
    });
  }

  openManeuverWindow() {
    this.maneuverSelections = {
        attribute: null,
        temper: null,
        context: null
    };
    this.focusPointsByRow = {
        attributes: 0,
        tempers: 0
    };

    const content = `
        <div class="maneuver-modal">
            <div class="maneuver-grid">
                <div class="section">
                    <h3>On which of your attributes are you relying on?</h3>
                    <div id="attribute-section" class="button-group">
                        ${['body', 'soul', 'mind', 'martial', 'elementary', 'rhetoric'].map(attr => 
                            `<div class="attribute-choice die-${this.getDieType(attr, 'attributes')}" data-attribute="${attr}">
                                ${attr}
                            </div>`
                        ).join('')}
                    </div>
                    <div class="focus-checkbox-container" id="focus-attributes"></div>
                    <div class="die-display" id="attributes-die"></div>
                </div>

                <div class="section">
                    <h3>What is your current state of mind?</h3>
                    <div id="temper-section" class="button-group">
                        ${['passion', 'empathy', 'rigor', 'independence'].map(temper => 
                            `<div class="temper-choice die-${this.getDieType(temper, 'tempers')}" data-temper="${temper}">
                                ${temper}
                            </div>`
                        ).join('')}
                    </div>
                    <div class="focus-checkbox-container" id="focus-tempers"></div>
                    <div class="die-display" id="tempers-die"></div>
                </div>

                <div class="section">
                    <h3>Is the context advantageous?</h3>
                    <div id="context-section" class="button-group">
                        <div class="context-choice die-malus" data-context="malus">Detrimental</div>
                        <div class="context-choice die-neutral" data-context="neutral">Neutral</div>
                        <div class="context-choice die-bonus" data-context="bonus">Favorable</div>
                        <div class="context-choice die-critical" data-context="critical">Highly Beneficial</div>
                    </div>
                    <div class="die-display" id="context-die"></div>
                </div>
            </div>

            <div class="footer">
                <div class="focus-counter">
                    <span id="maneuver-focus-number">${this.actor.system.focusPoints.current}</span> focus points remaining
                </div>
                <button class="roll-dice disabled" id="roll-dice-button">
                    <i class="fas fa-dice"></i>
                    <span class="roll-text">Please answer all 3 questions</span>
                </button>
            </div>
        </div>
    `;

    new Dialog({
        title: "Maneuver",
        content: content,
        buttons: {},
        render: (html) => this.attachManeuverListeners(html)
    },{
      width: 800,  // Ajuster cette valeur selon vos besoins
      height: 975  // Ajuster cette valeur selon vos besoins
  }).render(true);
}

attachManeuverListeners(html) {
  // Désactiver les tempers traumatisés
  const tempers = ['passion', 'empathy', 'rigor', 'independence'];
  tempers.forEach(temper => {
      if (this.actor.system.tempers[temper].injury) { // Vérifie si le temper est en état de trauma
          const temperButton = html.find(`.temper-choice[data-temper="${temper}"]`);
          temperButton.prop('disabled', true).addClass('disabled').css({
              'background-color': 'lightgrey',
              'color': 'darkgrey',
              'cursor': 'not-allowed',
              'border': 'none', // Supprime la bordure pour un état désactivé visuel
          });
      }
  });

  // Écouteurs pour les attributs
  html.find('.attribute-choice').on('click', (event) => {
      const element = $(event.currentTarget);
      const attribute = element.data('attribute');
      
      element.siblings().removeClass('selected');
      element.addClass('selected');
      
      this.maneuverSelections.attribute = attribute;
      this.updateDieDisplay(html, 'attributes', attribute);
      this.updateFocusRow(html, 'attributes', attribute);
      this.checkAndUpdateRollButton(html);
  });

  // Écouteurs pour les tempers
  html.find('.temper-choice').on('click', (event) => {
      const element = $(event.currentTarget);
      const temper = element.data('temper');

      // Empêcher la sélection si le temper est traumatisé
      if (this.actor.system.tempers[temper].injury) return;

      element.siblings().removeClass('selected');
      element.addClass('selected');

      this.maneuverSelections.temper = temper;
      this.updateDieDisplay(html, 'tempers', temper);
      this.updateFocusRow(html, 'tempers', temper);
      this.checkAndUpdateRollButton(html);
  });

  // Écouteurs pour le contexte
  html.find('.context-choice').on('click', (event) => {
      const element = $(event.currentTarget);
      const context = element.data('context');
      
      element.siblings().removeClass('selected');
      element.addClass('selected');
      
      this.maneuverSelections.context = context;
      this.updateDieDisplay(html, 'context', context);
      this.checkAndUpdateRollButton(html);
  });

  // Bouton de lancer
  html.find('#roll-dice-button').on('click', () => {
      if (this.checkAllSelections()) {
          this.launchManeuver();
      }
  });
}

checkAllSelections() {
  return this.maneuverSelections.attribute && 
         this.maneuverSelections.temper && 
         this.maneuverSelections.context;
}

checkAndUpdateRollButton(html) {
  const canRoll = this.checkAllSelections();
  const rollButton = html.find('#roll-dice-button');
  const rollText = rollButton.find('.roll-text');
  
  if (canRoll) {
      rollButton.removeClass('disabled');
      rollText.text('Roll the Dice!');
  } else {
      rollButton.addClass('disabled');
      rollText.text('Please answer all 3 questions');
  }
}

updateFocusRow(html, type, selectedItem) {
  const focusContainer = html.find(`#focus-${type}`);
  const previousFocusPoints = this.focusPointsByRow[type];

  // Rétablir les points focus précédents au compteur remaining
  const remainingFocus = parseInt(html.find('#maneuver-focus-number').text());
  const newRemaining = remainingFocus + previousFocusPoints;
  html.find('#maneuver-focus-number').text(newRemaining);
  
  // Réinitialiser les points de focus pour cette ligne
  this.focusPointsByRow[type] = 0;
  
  // Vider le conteneur existant
  focusContainer.empty();
  
  if (type === 'context') return;
  
  const baseValue = type === 'attributes' 
      ? this.actor.system.attributes[selectedItem]?.currentValue
      : this.actor.system.tempers[selectedItem]?.currentValue;
  
  let numCheckboxes = 0;
  switch(baseValue) {
      case 'malus': numCheckboxes = 3; break;
      case 'neutral': numCheckboxes = 2; break;
      case 'bonus': numCheckboxes = 1; break;
      case 'critical': numCheckboxes = 0; break;
  }
  
  for (let i = 0; i < numCheckboxes; i++) {
      const checkbox = $(`<input type="checkbox" class="focus-checkbox" data-type="${type}" />`);
      focusContainer.append(checkbox);
      
      checkbox.on('change', (event) => {
          const currentRemaining = parseInt(html.find('#maneuver-focus-number').text());
          
          if (event.target.checked) {
              if (currentRemaining > 0) {
                  this.focusPointsByRow[type]++;
                  // Mettre à jour l'affichage des points restants
                  html.find('#maneuver-focus-number').text(currentRemaining - 1);
              } else {
                  event.preventDefault();
                  return;
              }
          } else {
              this.focusPointsByRow[type]--;
              // Rendre le point au compteur remaining
              html.find('#maneuver-focus-number').text(currentRemaining + 1);
          }
          
          const newDieType = this.calculateDieTypeWithFocus(baseValue, this.focusPointsByRow[type]);
          this.updateDieDisplay(html, type, selectedItem, newDieType);
      });
  }
  
  this.updateDieDisplay(html, type, selectedItem, baseValue);
}
updateFocusPointsDisplay(html, remainingFocus) {
  const focusDisplay = html.find('#maneuver-focus-number');
  focusDisplay.text(remainingFocus);

  // Si le focus restant est 0, désactivez les checkbox
  if (remainingFocus <= 0) {
      html.find('.focus-checkbox:not(:checked)').prop('disabled', true);
  } else {
      html.find('.focus-checkbox').prop('disabled', false);
  }
}

updateFocusPointsDisplay(html, remainingFocus) {
    const focusDisplay = html.find('#maneuver-focus-number');
    focusDisplay.text(remainingFocus);

    // Si le focus restant est 0, désactivez les checkbox
    if (remainingFocus <= 0) {
        html.find('.focus-checkbox:not(:checked)').prop('disabled', true);
    } else {
        html.find('.focus-checkbox').prop('disabled', false);
    }
}

disableFocusCheckboxes(html) {
  html.find('.focus-checkbox').prop('disabled', true);
}

initializeFocusState(html) {
  const currentFocus = this.actor.system.focusPoints.current;
  if (currentFocus <= 0) {
      this.disableFocusCheckboxes(html);
  }
}


handleProfileImageEditing(html) {
  html.find('.profile-image').on('click', async () => {
      const filePicker = new FilePicker({
          type: 'image',
          current: this.actor.img,
          callback: async (path) => {
              const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
              if (validExtensions.some(ext => path.endsWith(ext))) {
                  await this.actor.update({ img: path });
              } else {
                  ui.notifications.error("Invalid image format. Use PNG, JPG, JPEG, or WEBP.");
              }
          }
      });
      filePicker.render(true);
  });
}

  updateActiveState(html, selector, activeElement) {
    html.find(selector).removeClass('active');
    $(activeElement).addClass('active');
  }

  updateFocusSection(html, selectedItem, type) {
    if (type === 'context') {
      return; // Skip context focus handling
    }

    const focusContainer = html.find(`#focus-${type}`);
    if (focusContainer.length === 0) {
      console.error(`Focus container not found for type: ${type}`);
      return;
    }

    focusContainer.empty(); // Clear checkboxes for the selected section
    let numCheckboxes = this.getNumCheckboxes(this.getDieType(selectedItem, type));

    // Initialize focusPointsUsed counter if not already done
    if (this.focusPointsUsed === undefined) {
      this.focusPointsUsed = 0;
    }

    // Render the checkboxes and attach the appropriate listeners
    for (let i = 0; i < numCheckboxes; i++) {
      const checkbox = $(`<input type="checkbox" class="focus-checkbox" data-type="${type}" data-item="${selectedItem}" />`);
      focusContainer.append(checkbox);

      checkbox.on('change', (event) => {
        // Prevent checking if no focus points are left
        if (this.maneuverFocus === 0 && event.target.checked) {
          event.preventDefault();
          this.blipFocusCounter(); // Blip if no focus points left and trying to check
          return;
        }

        const checkedBoxes = focusContainer.find(':checked').length;

        const newValue = this.updateDieValueBasedOnFocus(type, this.getDieType(selectedItem, type), checkedBoxes);
        this.updateDieDisplay(html, type, selectedItem, newValue);

        // ** Handle focus points correctly for checking and unchecking **
        if (event.target.checked) {
          this.updateManeuverFocus(-1);  // Decrease focus when checking
          this.focusPointsUsed++;  // Increase focus points used
        } else {
          this.updateManeuverFocus(1);   // Increase focus when unchecking
          this.focusPointsUsed--;  // Decrease focus points used
        }
      });

      // ** Blip effect for disabled checkboxes when clicked **
      checkbox.on('click', (event) => {
        if (checkbox.prop('disabled')) {
          this.blipFocusCounter();  // Trigger the blip effect for disabled checkboxes
        }
      });
    }
}


  // Method to get the number of checkboxes based on the die type
  getNumCheckboxes(dieType) {
    switch (dieType) {
      case 'malus':
        return 3; // Malus has 3 checkboxes
      case 'neutral':
        return 2; // Neutral has 2 checkboxes
      case 'bonus':
        return 1;
      case 'critical':
        return 0; // Bonus and Critical have 1 checkbox
      default:
        return 0; // Default case
    }
  }

  refundFocusPoints(selectedItem) {
    if (!selectedItem) return;
  
    // Logique pour rembourser les focus points utilisés
    const usedFocusPoints = this.focusPointsUsed; // À ajuster selon votre structure
    this.maneuverFocus += usedFocusPoints; // Remboursement des points
    this.focusPointsUsed = 0; // Réinitialisation du compteur de points utilisés
  
    // Mettez à jour l'affichage des focus points
    const focusDisplay = $('.focus-counter #maneuver-focus-number');
    focusDisplay.text(this.maneuverFocus);
  }
  

  updateRollButtonState(html) {
    const rollButton = html.find('.roll-dice');
    const isAllSelected = this.selectedAttribute && this.selectedTemper && this.selectedContext;
  
    if (isAllSelected) {
      rollButton.prop('disabled', false).html('<i class="fas fa-dice"></i> Roll the dice!');
    } else {
      rollButton.prop('disabled', true).html('<i class="fas fa-dice"></i> Please answer all 3 questions.');
    }
  
    rollButton.toggleClass('disabled', !isAllSelected);
  }

  
  // Count focus checkboxes based on dice type for attributes

  getAttributeFocusCount(attribute) {
    const attributeData = this.actor.system.attributes[attribute];
    if (!attributeData) {
      console.warn(`Attribute ${attribute} not found in actor data`);
      return 0;
    }
    
    switch (attributeData.currentValue) {
      case 'malus': return 3;
      case 'neutral': return 2;
      case 'bonus': return 1;
      case 'critical': return 0;
      default: return 0;
    }
  }
// Count focus checkboxes based on dice type for tempers
getTemperFocusCount(temper) {
  const temperData = this.actor.system.tempers[temper];
  if (!temperData) {
    console.warn(`Temper ${temper} not found in actor data`);
    return 0;
  }
  
  switch (temperData.currentValue) {
    case 'malus': return 3;
    case 'neutral': return 2;
    case 'bonus': return 1;
    case 'critical': return 0;
    default: return 0;
  }
}

// Count focus checkboxes based on dice type for contexts
getContextFocusCount(context) {
  switch (context) {
    case 'malus': return 3; // Detrimental context has 3 checkboxes
    case 'neutral': return 2; // Neutral context has 2 checkboxes
    case 'bonus': return 1; // Favorable context has 1 checkbox
    case 'critical': return 0; // Highly beneficial context has no checkboxes
    default: return 0; // No checkboxes
  }
}

blipFocusCounter() {
  const focusCounter = document.querySelector('.focus-counter');

  // Définir l'animation de blip en rouge et plus dure
  focusCounter.style.transition = 'background-color 0.2s ease, transform 0.1s ease';
  focusCounter.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
  focusCounter.style.transform = 'scale(1.2)';

  // Remettre à l'état normal après 300ms
  setTimeout(() => {
    focusCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    focusCounter.style.transform = 'scale(1)';
  }, 300);
}
  
updateDieValueBasedOnFocus(type, baseValue, focusPoints) {
  const dieValues = ['malus', 'neutral', 'bonus', 'critical'];
  let index = dieValues.indexOf(baseValue);
  index = Math.min(dieValues.length - 1, index + focusPoints);
  return dieValues[index];
}

// Method to retrieve and handle focus point changes
updateManeuverFocus(change) {
  if (typeof change !== 'number' || isNaN(change)) {
    console.error('Invalid change value for maneuverFocus:', change);
    return;
  }

  // Ensure focus points never drop below 0
  this.maneuverFocus = Math.max(0, this.maneuverFocus + change);

  const maneuverFocusElement = document.getElementById('maneuver-focus-number');
  if (maneuverFocusElement) {
    maneuverFocusElement.textContent = this.maneuverFocus;
  }

  // If focus is at zero, disable the checkboxes
  if (this.maneuverFocus <= 0) {
    this.disableFocusCheckboxes();
  } else {
    this.enableFocusCheckboxes();
  }
}

// Disable all focus checkboxes when focus is zero
disableFocusCheckboxes() {
  document.querySelectorAll('.focus-checkbox').forEach((checkbox) => {
    checkbox.disabled = true;
  });
}

// Enable focus checkboxes when there is enough focus
enableFocusCheckboxes() {
  document.querySelectorAll('.focus-checkbox').forEach((checkbox) => {
    checkbox.disabled = false;
  });
}




updateFocusDisplay() {
  const maneuverFocusElement = document.getElementById('maneuver-focus-number');
  if (maneuverFocusElement) {
    maneuverFocusElement.textContent = `${this.maneuverFocus}`;
  }

  // Désactiver les checkboxes non cochées si le focus restant est à zéro
  $('.focus-checkbox').each((index, checkbox) => {
    if (!checkbox.checked && this.maneuverFocus === 0) {
      $(checkbox).prop('disabled', true); // Désactive les checkboxes non cochées
    } else {
      $(checkbox).prop('disabled', false); // Réactive les checkboxes si le focus est disponible
    }
  });
}

// Ensure focus points are correctly counted
getUsedFocus() {
  const attributeFocus = this.getCheckedBoxes('attributes');
  const temperFocus = this.getCheckedBoxes('tempers');
  return attributeFocus + temperFocus;
}

getCheckedBoxes(type) {
  return $(`#focus-${type}-section .focus-checkbox:checked`).length;
}


  
  // Disable any traumatized tempers in the maneuver modal
  disableTraumatizedTempers(html) {
    const tempers = ['passion', 'empathy', 'rigor', 'independence'];
  
    tempers.forEach(temper => {
      if (this.actor.system.tempers[temper].injury) { // If trauma exists for this temper
        const temperButton = html.find(`.temper-choice[data-temper="${temper}"]`);
        temperButton.prop('disabled', true).addClass('disabled').css({
          'background-color': 'lightgrey',
          'color': 'darkgrey',
          'cursor': 'not-allowed',
          'border': 'none', // Remove border to show disabled state
        });
      }
    });
  }
  
// Mise à jour de la méthode updateDieDisplay
updateDieDisplay(html, type, selectedItem) {
  const dieDisplay = html.find(`#${type}-die`);
  if (!dieDisplay.length) return;
  
  let dieType;
  
  // Déterminer le type de dé en fonction du focus
  if (type === 'context') {
      dieType = selectedItem;
  } else {
      const baseValue = type === 'attributes' ? 
          this.actor.system.attributes[selectedItem]?.currentValue : 
          this.actor.system.tempers[selectedItem]?.currentValue;
      const focusPoints = this.focusPointsByRow[type] || 0;
      dieType = this.calculateDieTypeWithFocus(baseValue, focusPoints);
  }

  dieType = String(dieType).toLowerCase();
  dieDisplay.attr('class', `die-display die-${dieType}`);
  dieDisplay.html(`<i class="fas fa-dice"></i> ${dieType.charAt(0).toUpperCase() + dieType.slice(1)}`);
}
// Nouvelle méthode pour mettre à jour le bouton Roll the Dice
updateRollButton(html) {
  const rollButton = html.find('.roll-dice');
  const rollText = rollButton.find('.roll-text');
  const isComplete = this.checkAllSelectionsComplete();

  if (isComplete) {
      rollButton.removeClass('disabled');
      rollText.text('Roll the Dice!');
  } else {
      rollButton.addClass('disabled');
      rollText.text('Please answer all 3 questions');
  }
}

// Méthode auxiliaire pour vérifier si toutes les sélections sont faites
checkAllSelectionsComplete() {
  return this.maneuverSelections.attribute && 
         this.maneuverSelections.temper && 
         this.maneuverSelections.context;
}
  
getDieType(item, category) {
  if (category === 'attributes') {
      return this.actor.system.attributes[item]?.currentValue || 'neutral';
  } else if (category === 'tempers') {
      return this.actor.system.tempers[item]?.currentValue || 'neutral';
  } else if (category === 'context') {
      // Mapping direct des labels de contexte vers les types de dés
      const contextMapping = {
          'Detrimental': 'malus',
          'Neutral': 'neutral',
          'Favorable': 'bonus',
          'Highly Beneficial': 'critical'
      };
      return contextMapping[item] || 'neutral';
  }
  return 'neutral';
}

updateRollButtonState(html) {
  const rollButton = html.find('.roll-dice');
  const isAllSelected = this.selectedAttribute && this.selectedTemper && this.selectedContext;

  rollButton.toggleClass('disabled', !isAllSelected);
  rollButton.find('.roll-text').text(isAllSelected ? 'Roll the dice!' : 'Please answer all 3 questions');

  if (isAllSelected) {
    rollButton.on('click', () => this.launchManeuver());
  } else {
    rollButton.off('click');
  }
}

async _onFocusPointsVisibilityChange(event) {
  event.preventDefault();
  const isVisible = event.target.checked;
  await this.actor.update({ "system.focusPoints.isVisible": isVisible });
}

async _onAddFocusPoints(event) {
  event.preventDefault();
  const currentFocus = this.actor.system.focusPoints.current;
  await this.actor.update({ "system.focusPoints.current": currentFocus + 1 });
}

async _onSubtractFocusPoints(event) {
  event.preventDefault();
  const currentFocus = this.actor.system.focusPoints.current;
  if (currentFocus > 0) {
    await this.actor.update({ "system.focusPoints.current": currentFocus - 1 });
  }
}



    async launchManeuver() {
      if (!this.checkAllSelections()) return;
  
      // Calculer le total des focus points utilisés
      const totalFocusUsed = Object.values(this.focusPointsByRow).reduce((a, b) => a + b, 0);
      console.log("Total Focus Used :", totalFocusUsed);
  
      // Vérifier si totalFocusUsed est NaN
      if (isNaN(totalFocusUsed)) {
          console.error("Erreur : totalFocusUsed est NaN !");
          return;
      }
  
      // Déduire les points de focus
      const currentFocus = this.actor.system.focusPoints.current;
      const remainingFocus = currentFocus - totalFocusUsed;
  
      if (remainingFocus < 0) {
          console.warn("Focus points cannot be negative. Resetting to 0.");
          await this.actor.update({ 'system.focusPoints.current': 0 });
      } else {
          await this.actor.update({
              'system.focusPoints.current': remainingFocus,
              'system.focusPoints.base': remainingFocus
          });
      }
  
      // Procéder aux dés et autres logiques
      const attributeValue = this.calculateFinalDieValue('attributes');
      const temperValue = this.calculateFinalDieValue('tempers');
      const contextValue = this.maneuverSelections.context;
  
      const results = await Promise.all([
          this.rollDie(attributeValue),
          this.rollDie(temperValue),
          this.rollDie(contextValue)
      ]);
  
      const focusMessage = totalFocusUsed > 0 ? ` with ${totalFocusUsed} focus points` : '';
  
      const chatContent = `
      <div class="dice-roll">
          <div class="dice-result">
              <!-- Message décrivant ce qui a été lancé -->
              <div style="margin-bottom: 5px;">
                  <strong>${this.actor.name}</strong> rolled 
                  <span style="color: #e63946;">
                      ${this.maneuverSelections.attribute.charAt(0).toUpperCase() + this.maneuverSelections.attribute.slice(1)}
                  </span>, 
                  <span style="color: #2a9d8f;">
                      ${this.maneuverSelections.temper.charAt(0).toUpperCase() + this.maneuverSelections.temper.slice(1)}
                  </span>, and 
                  <span style="color: #8f8f8f;"> 
                      ${this.getContextName(this.maneuverSelections.context)}
                  </span> 
                  with ${totalFocusUsed} focus points.
              </div>
  
              <!-- Icônes et résultats -->
              <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                  ${this.getIconWithResult(results[0], 'attribute')}
                  ${this.getIconWithResult(results[1], 'temper')}
                  ${this.getIconWithResult(results[2], 'context')}
              </div>
          </div>
      </div>
  `;
  

      await ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: chatContent
      });
  
      this.closeManeuverModal();
  }
  
  getIconWithResult(result, type) {
    let color = '';
    let iconPath = '';
    switch (result.toLowerCase()) {
        case 'setback':
            color = '#e63946'; // Rouge pour setback
            iconPath = 'systems/weave_of_echoes/module/icons/setbackIcon.svg';
            break;
        case 'gain':
            color = '#2a9d8f'; // Vert pour gain
            iconPath = 'systems/weave_of_echoes/module/icons/gainIcon.svg';
            break;
        case 'nothing':
        case 'neutral':
            color = '#8f8f8f'; // Gris pour nothing/neutral
            iconPath = 'systems/weave_of_echoes/module/icons/nothingIcon.svg';
            break;
        default:
            color = '#f4a261'; // Couleur par défaut (orange clair)
            iconPath = 'systems/weave_of_echoes/module/icons/defaultIcon.svg'; // Par exemple, une icône générique
    }

    return `
        <span style="color: ${color};">
            <img src="${iconPath}" style="width: 24px; height: 24px; vertical-align: middle; border: none;" />
            ${result.charAt(0).toUpperCase() + result.slice(1)} <!-- Affiche le texte du résultat -->
        </span>
    `;
}
  async syncFocusPointsWithRemaining(remainingFocus) {
 
    if (remainingFocus < 0) {
        console.warn("Focus points cannot be negative. Resetting to 0.");
        await this.actor.update({ 'system.focusPoints.current': 0 });
    } else {
        await this.actor.update({
            'system.focusPoints.current': remainingFocus,
            'system.focusPoints.base': remainingFocus
        });
    }
}


  
  formatDieResult(result, dieType) {
      const getIcon = (result) => {
          if (result.includes('Gain')) return '✓';
          if (result.includes('Setback')) return '✗';
          return '−';
      };
  
      const getColor = (dieType) => {
          const colors = {
              malus: '#aecbfa',
              neutral: '#fef49c',
              bonus: '#81c995',
              critical: '#f28b82'
          };
          return colors[dieType] || '#fef49c';
      };
  
      return `
          <span style="color: ${getColor(dieType)};">
              ${getIcon(result)} ${result}
          </span>
      `;
  }
    // Fonction pour calculer la valeur finale en tenant compte des focus points
    calculateFinalDieValue(type) {
      const selection = this.maneuverSelections[type === 'attributes' ? 'attribute' : 'temper'];
      const baseValue = type === 'attributes' ?
          this.actor.system.attributes[selection]?.currentValue :
          this.actor.system.tempers[selection]?.currentValue;
      return this.calculateDieTypeWithFocus(baseValue, this.focusPointsByRow[type] || 0);
  }
  
  calculateDieTypeWithFocus(baseValue, focusPoints) {
    const dieValues = ['malus', 'neutral', 'bonus', 'critical'];
    const currentIndex = dieValues.indexOf(baseValue);
    return dieValues[Math.min(currentIndex + focusPoints, dieValues.length - 1)];
}

    getResultIcon(result) {
      const icons = {
        Gain: '<i class="fas fa-check-circle" style="color: #81c995;"></i>',
        Stalemate: '<i class="fas fa-minus-circle" style="color: #fef49c;"></i>',
        Setback: '<i class="fas fa-times-circle" style="color: #f28b82;"></i>'
      };
    
      return icons[result] || result; // Retourne l'icône si elle existe, sinon le texte brut
    }
    
  
    closeManeuverModal() {
      const modalElement = document.querySelector('.maneuver-modal');
      if (modalElement) {
        const dialogElement = modalElement.closest('.app.dialog');
        if (dialogElement) {
          dialogElement.remove();
        }
      }
    
      this.focusPointsUsed = 0;
    }

// Helper method to get the readable context name
getContextName(contextType) {
  switch (contextType) {
    case 'malus': return 'Detrimental';
    case 'neutral': return 'Neutral';
    case 'bonus': return 'Favorable';
    case 'critical': return 'Highly Beneficial';
    default: return contextType;
  }
}

getAffinityLabel(value) {
  switch (value) {
    case 1: return "Enemy";
    case 2: return "Acquaintance";
    case 3: return "Friend";
    case 4: return "Soulmate";
    default: return "Acquaintance";
  }
}

getDynamicLabel(value) {
  switch (value) {
    case 0.5: return "Superior";
    case 0.7: return "Inferior";
    case 0.8: return "Rival";
    case 1.0: return "Equal";
    default: return "Equal";
  }
}

// Helper method to get the colored label with capitalized words
getColoredLabel(label) {
  if (!label) {
    console.error("Label is null or undefined in getColoredLabel.");
    return ""; // Retourne une chaîne vide ou une valeur par défaut appropriée
  }

  // Le label est valide, continuez avec le traitement normal
  const [firstPart, secondPart] = label.split(":");
  return `<span style="color: ${secondPart}">${firstPart}</span>`;
}


manageTemperEdition(html) {
  const updateTemper = async (path, newValue) => {
      await this.actor.update({
          [path]: newValue,
          [`${path.replace('baseValue', 'currentValue')}`]: newValue
      });
      this.render(); // Re-rendre la fiche pour refléter les changements
  };

  const setupDropdownHandler = (html, temper) => {
      const selector = `.value-select[data-path="system.tempers.${temper}.baseValue"]`;
      html.find(selector).on('change', async (event) => {
          const select = $(event.currentTarget);
          const newValue = select.val(); // La nouvelle valeur sélectionnée
          const path = select.data('path'); // Le chemin de la propriété (baseValue)
          await updateTemper(path, newValue);
      });
  };

  // Pour chaque temper, configurez les gestionnaires d'événements
  ['passion', 'empathy', 'rigor', 'independence'].forEach(temper => {
      setupDropdownHandler(html, temper);
  });
}



// This function degrades the value of the attribute as the injuries increase
degradeAttributeValue(value) {
  switch (value) {
    case 'critical':
      return 'bonus';
    case 'bonus':
      return 'neutral';
    case 'neutral':
      return 'malus';
    case 'malus':
      return 'malus';  // Stays at malus
    default:
      return value;
  }
}

handleNameEditing(html) {
  const nameInput = html.find('#name-edit');
  const nameSpan = html.find('#actor-name');

  // Rendre le champ éditable au clic
  nameSpan.on('click', () => {
    nameSpan.addClass('hidden');
    nameInput.removeClass('hidden').focus().val(this.actor.name);
  });

  // Sauvegarde au blur ou à l'appui sur Entrée
  nameInput.on('blur keydown', async (event) => {
    if (event.type === 'keydown' && event.key === 'Enter') {
      event.preventDefault(); // Empêche l'événement de se propager à d'autres éléments
      event.stopPropagation(); // Arrête la propagation de l'événement
    }

    if (event.type === 'blur' || (event.type === 'keydown' && event.key === 'Enter')) {
      const newName = nameInput.val().trim();
      if (newName && newName !== this.actor.name) {
        await this.actor.update({ name: newName });
      }
      nameInput.addClass('hidden');
      nameSpan.removeClass('hidden');
    }
  });
}



handleStaminaMaxEditing(html) {
  const staminaMaxContainer = html.find('#stamina-max-container');
  const staminaMaxDisplay = html.find('#stamina-max');
  const staminaMaxInput = html.find('#stamina-max-edit');

  if (!staminaMaxContainer.length || !staminaMaxDisplay.length || !staminaMaxInput.length) {
    console.error("Stamina Max elements are missing in the template.");
    return;
  }

  // Activer l'édition au clic sur le conteneur
  staminaMaxContainer.on('click', () => {
    staminaMaxInput.val(staminaMaxDisplay.text().trim()); // Pré-remplir avec la valeur actuelle
    staminaMaxContainer.hide();
    staminaMaxInput.removeClass('hidden').focus();
  });

  // Sauvegarder la valeur lorsqu'on quitte le champ
  staminaMaxInput.on('blur', async () => {
    const newMaxStamina = parseInt(staminaMaxInput.val().trim(), 10);

    if (!isNaN(newMaxStamina) && newMaxStamina > 0) {
      await this.actor.update({ "system.stamina.max": newMaxStamina });

      // Vérifier que la current Stamina ne dépasse pas la nouvelle max
      const currentStamina = Math.min(this.actor.system.stamina.current, newMaxStamina);
      await this.actor.update({ "system.stamina.current": currentStamina });

      // Mettre à jour l'affichage
      staminaMaxDisplay.text(newMaxStamina);
      html.find('#current-stamina').text(currentStamina); // Mettre à jour la current
    }

    staminaMaxContainer.show();
    staminaMaxInput.addClass('hidden');
  });

  // Sauvegarde via la touche Entrée
  staminaMaxInput.on('keydown', async (event) => {
    if (event.key === 'Enter') {
      staminaMaxInput.blur(); // Déclencher l'événement blur pour sauvegarder
    }
  });
}


handleStaminaEditing(html) {
  const staminaMinus = html.find('#stamina-minus');
  const staminaPlus = html.find('#stamina-plus');
  const maxStamina = this.actor.system.stamina.max;

  // Diminuer la Stamina
  staminaMinus.on('click', async () => {
    const currentStamina = this.actor.system.stamina.current;
    if (currentStamina > 0) {
      await this.actor.update({ "system.stamina.current": currentStamina - 1 });
    }
  });

  // Augmenter la Stamina
  staminaPlus.on('click', async () => {
    const currentStamina = this.actor.system.stamina.current;
    if (currentStamina < maxStamina) {
      await this.actor.update({ "system.stamina.current": currentStamina + 1 });
    }
  });
}


handleFocusToggle(html) {
  const toggle = html.find('#focus-toggle');
  
  toggle.on('change', async (event) => {
    const isVisible = event.target.checked;
    await this.actor.update({ "system.focusPoints.isVisible": isVisible });
  });
}


Untitled

handleFocusEditing(html) {
  // Gestion du bouton -
  html.find('#focus-minus').on('click', async () => {
    const current = this.actor.system.focusPoints.current;
    if (current > 0) {
      await this.actor.update({
        'system.focusPoints.current': current - 1
      });
    }
  });

  // Gestion du bouton +
  html.find('#focus-plus').on('click', async () => {
    const current = this.actor.system.focusPoints.current;
    await this.actor.update({
      'system.focusPoints.current': current + 1
    });
  });
}

handleMasteryLevelEditing(html) {
   // Mastery Level Edit
   const masteryLevelView = html.find("#mastery-level-view");
   const masteryLevelEdit = html.find("#mastery-level-edit");
 
   masteryLevelView.on("click", () => {
     masteryLevelView.addClass("hidden");
     masteryLevelEdit.removeClass("hidden").focus();
   });
 
   masteryLevelEdit.on("blur change", (event) => {
     const newValue = parseInt(event.target.value);
     if (!isNaN(newValue)) {
       this.actor.update({ "system.masteryLevel": newValue });
     }
     masteryLevelEdit.addClass("hidden");
     masteryLevelView.removeClass("hidden");
   });
}

calculateMasteryPoints() {
  const attributes = this.actor.system.attributes;
  let points = 0;
  
  Object.values(attributes).forEach(attr => {
    switch(attr.baseValue) {
      case 'malus': points -= 1; break;
      case 'neutral': break;  // +0
      case 'bonus': points += 1; break;
      case 'critical': points += 2; break;
    }
  });

  return points;
}

_recalculateMasteryPoints() {
  let masteryPoints = 0;
  for (let attrKey in this.actor.system.attributes) {
    const attr = this.actor.system.attributes[attrKey];
    switch (attr.baseValue) {
      case 'malus': masteryPoints -= 1; break;
      case 'neutral': masteryPoints += 0; break;
      case 'bonus': masteryPoints += 1; break;
      case 'critical': masteryPoints += 2; break;
    }
  }
  this.actor.update({ 'system.masteryPoints': masteryPoints });
}

// _updateMasteryColors() {
//   const masteryPoints = this.actor.system.masteryPoints;
//   const masteryLevel = this.actor.system.masteryLevel;
//   const masteryElement = this.element.querySelector('.mastery-points .mastery-value');

//   if (masteryPoints !== masteryLevel) {
//     masteryElement.classList.add('mismatched');
//     masteryElement.style.color = "#f28b82"; // Rouge des dés "Critical"
//   } else {
//     masteryElement.classList.remove('mismatched');
//     masteryElement.style.color = "#81c995"; // Vert des dés "Bonus"
//   }
// }

  handleElementEditing(html) {
    const elementView = html.find('#element-view');
    const elementSelect = html.find('#element-edit');
  
    if (!elementView.length || !elementSelect.length) {
      console.error("Element editing elements missing in the template.");
      return;
    }
  
    // Afficher la liste déroulante au clic
    elementView.on('click', () => {
      elementSelect.val(this.actor.system.element.value); // Pré-remplir la liste déroulante
      elementView.hide();
      elementSelect.show().focus();
    });
  
    // Mettre à jour l'élément après sélection
    elementSelect.on('blur change', async () => {
      const newElement = elementSelect.val();
      if (newElement) {
        await this.actor.update({ "system.element.value": newElement });
  
        // Mettre à jour l'affichage avec une majuscule et un symbole
        elementView.html(`
          ${newElement.charAt(0).toUpperCase() + newElement.slice(1)}
          <i class="element-icon ${newElement}"></i>
        `).show();
      }
      elementSelect.hide();
    });
  }

  handleCardEdit(event, html) {
    event.preventDefault();
    event.stopPropagation();
    
    const indicator = $(event.currentTarget);
    const card = indicator.closest('.attribute-card, .temper-card');
    const dropdown = card.find('.value-select');
    const type = card.data('type');
    const fieldName = card.data('field');

    // Fonction de mise à jour commune
    const updateValue = async (newValue) => {
      try {
        await this.actor.update({
          [`system.${type}.${fieldName}.baseValue`]: newValue,
          [`system.${type}.${fieldName}.currentValue`]: newValue
        });
  
        // Calculer et mettre à jour les mastery points
        const attributes = this.actor.system.attributes;
        let points = 0;
        Object.values(attributes).forEach(attr => {
          switch(attr.baseValue) {
            case 'malus': points -= 1; break;
            case 'neutral': break; // +0
            case 'bonus': points += 1; break;
            case 'critical': points += 2; break;
          }
        });
        
        await this.actor.update({ 'system.masteryPoints': points });
        
        await this.render(false);
        return true;
      } catch (error) {
        console.error('Error updating value:', error);
        return false;
      }
    };

    // Gestionnaire pour le clic sur une option
    const handleOptionClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const newValue = $(e.currentTarget).data('value');
        dropdown.removeClass('visible');
        
        $(document).off('mousedown.cardEdit');
        dropdown.find('.option').off('click.cardEdit');
        
        await updateValue(newValue);
    };

    // Gestionnaire pour le clic en dehors
    const handleClickOutside = async (e) => {
        if (!$(e.target).closest('.value-select').length && 
            !$(e.target).closest('.edit-button').length) {
            
            const dropdownValue = dropdown.val();
            
            if (dropdownValue) {
                $(document).off('mousedown.cardEdit');
                dropdown.find('.option').off('click.cardEdit');
                dropdown.removeClass('visible');
                
                await updateValue(dropdownValue);
            } else {
                dropdown.removeClass('visible');
            }
        }
    };

    // Gérer l'affichage du dropdown
    if (!dropdown.hasClass('visible')) {
        dropdown.addClass('visible');
        
        const currentValue = this.actor.system[type][fieldName].currentValue;
        dropdown.find('.option').removeClass('selected');
        dropdown.find(`.option[data-value="${currentValue}"]`).addClass('selected');
        
        dropdown.find('.option').on('click.cardEdit', handleOptionClick);
        
        setTimeout(() => {
            $(document).on('mousedown.cardEdit', handleClickOutside);
        }, 0);
    }
}

  async updateAttributeCurrentValue(attribute) {
    const attr = this.actor.system.attributes[attribute];
    let currentValue = attr.baseValue;

    if (attr.injuries.injury1) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.injuries.injury2) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.injuries.injury3) currentValue = this.degradeAttributeValue(currentValue);

    await this.actor.update({ [`system.attributes.${attribute}.currentValue`]: currentValue });
  }

  degradeAttributeValue(value) {
    switch (value) {
      case 'critical':
        return 'bonus';
      case 'bonus':
        return 'neutral';
      case 'neutral':
        return 'malus';
      default:
        return value;
    }
  }

  manageTemperTrauma(html) {
    ['passion', 'empathy', 'rigor', 'independence'].forEach(temper => {
      html.find(`#${temper}-trauma`).on('change', async (event) => {
        const isChecked = event.target.checked;
        
        // Mise à jour du trauma uniquement
        await this.actor.update({
          [`system.tempers.${temper}.injury`]: isChecked,
        });
  
        this.render();
      });
    });
  }
  
  
  
  // Fonction d'aide pour dégrader la valeur
  degradeAttributeValue(value) {
    switch (value) {
      case 'critical':
        return 'bonus';
      case 'bonus':
        return 'neutral';
      case 'neutral':
        return 'malus';
      case 'malus':
        return 'malus';  // Reste à malus
      default:
        return value;
    }
  }

  addDiceListeners(html) {
    const selectedDice = []; // Pour stocker les dés sélectionnés
    const selectedDiceContainer = html.find('.selected-dice');
    const diceSlots = html.find('.dice-slot');
    const rollButton = html.find('.roll-selected-dice');
    const resetButton = html.find('.reset-selected-dice');

    // Gestionnaire pour l'ajout de dés
    html.find('.die-button').on('click', (event) => {
      const dieType = event.currentTarget.dataset.dieType;
      if (selectedDice.length < 6) {
        selectedDice.push(dieType);
        const dieElement = `<div class="selected-die ${dieType}" data-index="${selectedDice.length - 1}">${dieType.charAt(0).toUpperCase()}</div>`;
        diceSlots.eq(selectedDice.length - 1).html(dieElement);
        
        // Activation des boutons
        rollButton.prop('disabled', false);
        resetButton.prop('disabled', false);
      }
    });

    // Suppression d'un dé sélectionné
    selectedDiceContainer.on('click', '.selected-die', (event) => {
      const index = $(event.currentTarget).data('index');
      selectedDice.splice(index, 1);
      this.updateSelectedDice(diceSlots, selectedDice);
      
      // Mise à jour des boutons
      rollButton.prop('disabled', selectedDice.length === 0);
      resetButton.prop('disabled', selectedDice.length === 0);
    });

    // Reset des dés
    resetButton.on('click', () => {
      selectedDice.length = 0;
      diceSlots.empty(); // Vide tous les slots
      rollButton.prop('disabled', true);
      resetButton.prop('disabled', true);
    });

    // Lancer les dés avec le même code de gestion des résultats...
    rollButton.on('click', async () => {
      const results = [];
      for (let i = 0; i < selectedDice.length; i++) {
        const result = await this.rollDie(selectedDice[i]);
        results.push({ type: selectedDice[i], result: result });
      }

      let chatContent = `<div class="dice-roll">
        <div class="dice-result">
          <div style="margin-bottom: 10px;">
            <strong>${this.actor.name}</strong> launched ${selectedDice.length} dice:
          </div>`;

      results.forEach((res, index) => {
        chatContent += `
          <div style="margin: 5px 0;">
            Die ${index + 1} (${res.type}): ${this.getIconWithResult(res.result)}
          </div>`;
      });

      chatContent += `</div></div>`;

      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: chatContent
      });

      // Reset après le lancer
      selectedDice.length = 0;
      diceSlots.empty();
      rollButton.prop('disabled', true);
      resetButton.prop('disabled', true);
    });
  }

  updateSelectedDice(container, selectedDice) {
    container.empty(); // Vide tous les slots
    selectedDice.forEach((dieType, index) => {
      const dieElement = `<div class="selected-die ${dieType}" data-index="${index}">${dieType.charAt(0).toUpperCase()}</div>`;
      container.eq(index).html(dieElement);
    });
  }

  async handleSingleDiceRoll(type) {
    const capitalizedType = toUpperCaseValue(type);
    const result = await rollDie(type);
    this.displayRollResultsInChat(capitalizedType, result);
  }



async _onDeleteRelationship(event) {
  event.preventDefault();
  const index = event.currentTarget.dataset.index;

  const relationships = foundry.utils.deepClone(this.actor.system.relationships);
  relationships.splice(index, 1);

  await this.actor.update({ 'system.relationships': relationships });
  await this.updateDiscordLevels();



  this.render();
}

async _onAddRelationship(event) {
  event.preventDefault();

  // Garder une référence au sheet/actor pour l'utiliser dans le callback
  const actor = this.actor;

  // Helper functions pour obtenir les labels
  const getAffinityLabel = (value) => {
    switch (value) {
      case 1: return "Enemy";
      case 2: return "Acquaintance";
      case 3: return "Friend";
      case 4: return "Soulmate";
      default: return "Acquaintance";
    }
  };

  const getDynamicLabel = (value) => {
    switch (value) {
      case 0.5: return "Superior";
      case 0.7: return "Inferior";
      case 0.8: return "Rival";
      case 1.0: return "Equal";
      default: return "Equal";
    }
  };

  // Vérifiez les connexions existantes
  const currentConnections = actor.system?.relationships?.connections || [];

  // Filtrer les acteurs disponibles
  const availableActors = game.actors.filter(
    (a) =>
      a.id !== actor.id && // Exclure le personnage actuel
      a.type === "character" && // Seulement les personnages de type 'character'
      !currentConnections.some((conn) => conn.characterId === a.id) // Exclure les personnages déjà connectés
  );

  if (availableActors.length === 0) {
    ui.notifications.warn("No available characters to add a relationship with.");
    return;
  }

  // Créer la boîte de dialogue
  new Dialog({
    title: "Add New Relationship",
    content: `
        <form>
            <div class="form-group">
                <label>Select a character:</label>
                <select id="character-select" name="character">
                    ${availableActors
                      .map((actor) => `<option value="${actor.id}">${actor.name}</option>`)
                      .join("")}
                </select>
            </div>
            <div class="form-group">
                <label>Affinity:</label>
                <select name="affinity">
                    <option value="1">Enemy</option>
                    <option value="2" selected>Acquaintance</option>
                    <option value="3">Friend</option>
                    <option value="4">Soulmate</option>
                </select>
            </div>
            <div class="form-group">
                <label>Dynamic:</label>
                <select name="dynamic">
                    <option value="0.5">Superior</option>
                    <option value="0.7">Inferior</option>
                    <option value="0.8">Rival</option>
                    <option value="1.0" selected>Equal</option>
                </select>
            </div>
        </form>
    `,
    buttons: {
      add: {
        icon: '<i class="fas fa-plus"></i>',
        label: "Add",
        callback: async (html) => {
          const characterId = html.find('[name="character"]').val();
          const affinityValue = Number(html.find('[name="affinity"]').val());
          const dynamicValue = Number(html.find('[name="dynamic"]').val());

          const selectedActor = game.actors.get(characterId);
          if (!selectedActor) {
            ui.notifications.error("Character not found!");
            return;
          }

          // Créer une nouvelle connexion
          const newConnection = {
            characterId: characterId,
            characterName: selectedActor.name,
            affinity: {
              value: affinityValue,
              label: getAffinityLabel(affinityValue),
            },
            dynamic: {
              value: dynamicValue,
              label: getDynamicLabel(dynamicValue),
            },
            relationshipValue: Math.round(affinityValue * dynamicValue),
            notes: "A few words about him/her...",
          };

          // Ajouter la nouvelle connexion aux relations existantes
          const updatedConnections = [...currentConnections, newConnection];

          // Mettre à jour l'acteur
          await actor.update({
            "system.relationships.connections": updatedConnections,
          });
          await this.updateDiscordLevels();

          ui.notifications.info("Relationship added successfully!");
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "add",
    classes: ["relationship-dialog"], // Ajout de la classe spécifique
  }).render(true);
}

}

// Dice rolling logic
async function rollDie(type) {
  if (!type) return "undefined";

  type = type.toLowerCase();
  let roll = new Roll("1d12");
  await roll.evaluate();

  let result;
  switch (type) {
    case 'malus':
      result = (roll.total <= 7) ? "Setback" : (roll.total <= 11) ? "Nothing" : "Gain";
      break;
    case 'neutral':
      result = (roll.total <= 3) ? "Setback" : (roll.total <= 9) ? "Nothing" : "Gain";
      break;
    case 'bonus':
      result = (roll.total <= 2) ? "Setback" : (roll.total <= 7) ? "Nothing" : "Gain";
      break;
    case 'critical':
      result = (roll.total == 1) ? "Setback" : (roll.total <= 5) ? "Nothing" : "Gain";
      break;
    default:
      result = "undefined";
  }

  // Wrap the result in a styled span for Gain and Setback
  return formatResult(result);
}

// Function to format Gain and Setback with distinct styles
function formatResult(result) {
  switch (result) {
    case "Gain":
      return `<span class="result-gain"><strong>${result}</strong></span>`;
    case "Setback":
      return `<span class="result-setback"><strong>${result}</strong></span>`;
    case "Stalemate":
    default:
      return result;  // No change for Stalemate
  }
}


Handlebars.registerHelper("getSetting", function (module, key) {
  return game.settings.get(module, key);
});


Handlebars.registerHelper('renderGroupSynergy', function(groupSynergy) {
  const sheet = game.actors.get(this.actor.id)?.sheet;
  return sheet ? sheet.renderGroupSynergy(groupSynergy) : "No synergy data.";
});

Handlebars.registerHelper('isNumber', function(value) {
  return typeof value === 'number' && !isNaN(value);
});

Handlebars.registerHelper('multiply', function(a, b) {
  return Math.round((parseFloat(a) * parseFloat(b)) * 100) / 100;
});

Handlebars.registerHelper('multiply', function(connection) {
  if (!connection?.affinity?.value || !connection?.dynamic?.value) {
    return 0;
  }
  
  const affinityValue = parseInt(connection.affinity.value);
  const dynamicValue = parseFloat(connection.dynamic.value);
  
  return Math.round(affinityValue * dynamicValue);
});