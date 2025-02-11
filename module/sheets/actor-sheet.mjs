import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { BiographySystem } from '../biography-system.js';


// Helper function to capitalize the first letter of a string
function toUpperCaseValue(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

Handlebars.registerHelper("getResultIcon", function(result) {
  const icons = {
      Gain: '<i class="fas fa-check-circle" style="color: #81c995;"></i>',
      Stalemate: '<i class="fas fa-minus-circle" style="color: #fef49c;"></i>',
      Setback: '<i class="fas fa-times-circle" style="color: #f28b82;"></i>'
  };

  return new Handlebars.SafeString(icons[result] || result); // Sécurise l'affichage HTML
});


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

  html.find(".change-group, .return-to-my-group").on("click", async (event) => {
    await this.actor.updateBaseGroupSynergy();
});
html.find('.add-relationship').on('click', async (event) => {
  event.preventDefault();

  // Récupérer l'ID du personnage courant
  const actor = this.actor;
  const existingConnections = actor.system.relationships.connections || [];

  // Ouvrir une boîte de sélection pour choisir un personnage
  const allCharacters = game.actors.filter(a => a.id !== actor.id); // Exclure soi-même
  const choices = allCharacters.map(a => `<option value="${a.id}">${a.name}</option>`).join("");

  let dialogContent = `
    <form>
      <div class="form-group">
        <label for="character">Choose a Character:</label>
        <select id="character">${choices}</select>
      </div>
    </form>`;

  new Dialog({
    title: "Add Relationship",
    content: dialogContent,
    buttons: {
      add: {
        label: "Add",
        callback: async (html) => {
          const selectedCharacterId = html.find('#character').val();
          if (!selectedCharacterId) return;

          // Vérifier si la relation existe déjà
          const alreadyExists = existingConnections.some(conn => conn.characterId === selectedCharacterId);
          if (alreadyExists) {
            ui.notifications.warn("This relationship already exists!");
            return;
          }

          // Récupérer les infos du personnage cible
          const targetCharacter = game.actors.get(selectedCharacterId);
          if (!targetCharacter) {
            ui.notifications.error("Error: Character not found.");
            return;
          }

          // Créer la nouvelle relation avec des valeurs par défaut
          const newConnection = {
            characterId: selectedCharacterId,
            characterName: targetCharacter.name,
            img: targetCharacter.img,
            affinity: { value: 2, label: "Acquaintance" },
            dynamic: { value: 1, label: "Equal" },
            relationshipValue: 2
          };

          // Mettre à jour les relations
          const updatedConnections = [...existingConnections, newConnection];
          await actor.update({ 'system.relationships.connections': updatedConnections });

          // Vérifier immédiatement les missing ties
          await actor.checkAndPropagateGroupTies();
          actor.render(false);
        }
      },
      cancel: {
        label: "Cancel"
      }
    }
  }).render(true);
});

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
  
    // Initialisez les structures de données nécessaires
    const actorData = this.actor.toObject(false);



    if (!Array.isArray(actorData.system.relationships?.connections)) {
      console.warn("⚠️ [getData] - `connections` n'est pas un tableau, initialisation forcée.");
      actorData.system.relationships.connections = [];
  }
  
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
    actorData.system.relationships = actorData.system.relationships || { connections: [] };
    actorData.system.relationships.connections = Array.isArray(actorData.system.relationships.connections)
        ? actorData.system.relationships.connections
        : [];

        actorData.system.relationships.connections = actorData.system.relationships.connections.map(conn => {
          const relatedActor = game.actors.get(conn.characterId) || null;
      
          const affinityValue = conn.affinity?.value ?? 2;
          const dynamicValue = conn.dynamic?.value ?? 0;
          const discordValue = (!isNaN(affinityValue) && !isNaN(dynamicValue)) ? (affinityValue + dynamicValue) : 0;
          const discordModifier = (!isNaN(discordValue) && discordValue > 0) ? Math.round(discordValue / 2) : 0;


          
          let relatedModifier = 0;
          if (relatedActor) {
              const relatedConnection = relatedActor.system.relationships.connections.find(r => r.characterId === actorData._id);
              if (relatedConnection) {
                  relatedModifier = Math.ceil((relatedConnection.affinity.value + relatedConnection.dynamic.value) / 2);
              }
          }
      
          const connectionSynergyValue = Math.ceil((discordModifier + relatedModifier) / 2);
      
          return {
              ...conn,
              affinity: conn.affinity ?? { value: 2, label: "Acquaintance" },
              dynamic: conn.dynamic ?? { value: 0, label: "Equal" },
              discordValue,
              discordModifier,
              connectionSynergyValue,
              img: relatedActor?.img || "icons/svg/mystery-man.svg",
              playerName: relatedActor?.owner?.name || "Unknown"
          };
      });
      

    // Ajout des valeurs statiques pour Handlebars
    context.AFFINITY_VALUES = {
        0: "Soulmate",
        1: "Friend",
        2: "Acquaintance",
        3: "Enemy"
    };

    context.DYNAMIC_VALUES = {
        0: "Equal",
        1: "Rival",
        2: "Dependent",
        3: "Dominant"
    };


    // 🔥 Ajout des valeurs dans le contexte
    context.relationships = actorData.system.relationships.connections;

     const data = super.getData();


    // Group Info
    const groupLeaderId = this.actor.system.relationships.currentGroupLeader;
    const groupLeader = game.actors.get(groupLeaderId);
    
    if (groupLeader) {
        context.currentGroup = {
            leaderId: groupLeaderId,
            name: groupLeader.system.relationships.characterGroup.name,
            members: groupLeader.system.relationships.characterGroup.members || []
        };
    }
    
    context.personalGroup = this.actor.system.relationships.characterGroup;
    context.isInOwnGroup = groupLeaderId === this.actor.id;

    // Récupérer les informations de groupe
    const groupInfo = await this.getGroupInfoFromCharacterId(this.actor.id);

    // Group synergy logic
    const groupSize = this.actor.getGroupSize();
    const hasEnoughMembers = groupSize >= 3;
    const missingTies = hasEnoughMembers ? await this.checkRelationshipsWithinGroup(this.actor.id) : [];

    context.groupSynergy = {
        display: hasEnoughMembers ? 
            (missingTies.length ? 
                { type: 'missing', ties: missingTies } : 
                { type: 'value', current: this.actor.system.relationships.currentGroupSynergy || 0 }
            ) : 
            { type: 'none' },
        base: this.actor.calculateBaseSynergy(),
        current: actorData.system.relationships.groupSynergy.current
    };

    // Biography
    actorData.system.biography = actorData.system.biography || { entries: [] };
    actorData.system.biography.entries = Array.isArray(actorData.system.biography.entries)
      ? actorData.system.biography.entries
      : [];

    // Ajouter les acteurs disponibles pour de nouvelles relations
    context.actors = game.actors.filter(actor =>
        actor.id !== this.actor.id &&
        actor.type === "character" &&
        !actorData.system.relationships.connections.some(conn => conn.characterId === actor.id)
    );

    // Intégrer les données mises à jour dans le contexte
    context.actorData = actorData;
    context.system = actorData.system;
    context.actorName = this.actor.name;

    if (this.actor) {
        context.groupSize = this.actor.getGroupSize();  // 🔥 Stocke `groupSize` dans `context`
    } else {
        console.warn("⚠️ Impossible de récupérer l'actor pour getData()");
        context.groupSize = 0;  // 🔥 Empêche `undefined`
    }
   
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
    
  html.find('.add-relationship').on('click', async (event) => {
      event.preventDefault();
      const actor = this.actor;
      if (!actor) {
          console.error("Erreur : Aucun acteur trouvé.");
          return;
      }

      const existingConnections = actor.system.relationships?.connections || [];

      // Filtrer la liste des personnages disponibles pour enlever ceux qui ont déjà une relation
      let allCharacters = game.actors.filter(a => 
          a.type === "character" && 
          a.id !== actor.id &&
          !existingConnections.some(rel => rel.characterId === a.id)
      );

      if (allCharacters.length === 0) {
          ui.notifications.warn("Aucun personnage disponible pour une nouvelle relation.");
          return;
      }

      let selectedCharacter = await new Promise(resolve => {
          let dialogContent = `<form><div class="form-group"><label>Choisir un personnage :</label><select id="character-select">`;
          for (let char of allCharacters) {
              dialogContent += `<option value="${char.id}">${char.name}</option>`;
          }
          dialogContent += `</select></div></form>`;

          new Dialog({
              title: "Nouvelle Relation",
              content: dialogContent,
              buttons: {
                  confirm: {
                      label: "Ajouter",
                      callback: html => {
                          let choice = html.find("#character-select").val();
                          resolve(choice);
                      }
                  },
                  cancel: {
                      label: "Annuler",
                      callback: () => {
                          resolve(null);
                      }
                  }
              },
              default: "confirm"
          }).render(true);
      });

      if (!selectedCharacter) {
          console.warn("Aucun personnage sélectionné.");
          return;
      }

    
      const newRelation = {
          characterId: selectedCharacter,
          characterName: game.actors.get(selectedCharacter).name,
          affinity: { value: 2, label: "Acquaintance" },
          dynamic: { value: 1, label: "Neutral" },
          relationshipValue: 2
      };

      existingConnections.push(newRelation);
      await actor.update({ 'system.relationships.connections': existingConnections });

      await actor.checkAndPropagateGroupTies();
      actor.render(false);
  });
    

// ✅ Listener pour Affinity (avec sauvegarde)
html.find('.affinity-column input[type="radio"]').on('change', (event) => {
  const card = $(event.currentTarget).closest('.relationship-card');
  const affinityValue = parseInt($(event.currentTarget).val()) || 0;
  
  // 🔄 Sauvegarde dans l'actor
  const relationshipId = card.data('relationship-id');
 

  this.actor.update({ [`data.relationships.${relationshipId}.affinity`]: affinityValue })

  this.updateDiscordValue(event);
});

// ✅ Listener pour Dynamic (avec sauvegarde)
html.find('.dynamic-column input[type="radio"]').on('change', (event) => {
  const card = $(event.currentTarget).closest('.relationship-card');
  const dynamicValue = parseInt($(event.currentTarget).val()) || 0;

  // 🔄 Sauvegarde dans l'actor
  const relationshipId = card.data('relationship-id');


  this.actor.update({ [`data.relationships.${relationshipId}.dynamic`]: dynamicValue })

  this.updateDiscordValue(event);
});


// Vérifier et appliquer la classe `checked` au moment du rendu de la page
html.find('.affinity-column input[type="radio"]:checked').each(function() {
  $(this).closest('label').addClass('checked');
});

html.find('.dynamic-column input[type="radio"]:checked').each(function() {
  $(this).closest('label').addClass('checked dynamic-checked'); // Assurer la bonne couleur
});



html.on('click', '.support-die', async (event) => {


  const targetId = event.currentTarget.dataset.target;
  const dieType = event.currentTarget.getAttribute("data-type");

  const targetActor = game.actors.get(targetId);
  const targetName = targetActor ? targetActor.name : "Unknown Target";

  if (!dieType) {
    console.warn("DEBUG: Pas de dieType trouvé sur l'élément cliqué.");
    return;
  }

  const rollResult = await rollDie(dieType);
  const cleanResult = rollResult.replace(/<[^>]+>/g, "").trim().toLowerCase();
  const formattedResult = this.getIconWithResult(cleanResult, dieType);
  
  const message = `
  <div>
    <strong>${this.actor.name}</strong> supports <strong>${targetName}</strong> :
    ${formattedResult} 
  </div>
`;

ChatMessage.create({
  content: message, // Utilisation du message structuré
  speaker: ChatMessage.getSpeaker()
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
      await this.actor.updateBaseGroupSynergy();
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

     // Gestion du clic sur l'icône de modification dans chaque carte de relation
  html.find('.connection-bio-edit-icon').on('click', (event) => {
    const $container = $(event.currentTarget).closest('.connection-bio-container');
    // Masquer l'affichage en lecture seule et afficher le textarea
    $container.find('.connection-bio-display').addClass('hidden');
    const $textarea = $container.find('.connection-bio-edit');
    $textarea.removeClass('hidden').focus();
  });
  
  // Lorsque le textarea perd le focus, enregistrer et repasser en mode affichage
  html.find('.connection-bio-edit').on('blur', async (event) => {
    const $textarea = $(event.currentTarget);
    const newBio = $textarea.val();
    const $container = $textarea.closest('.connection-bio-container');
    const $display = $container.find('.connection-bio-display');
    
    // Récupérer l'ID de la connection ou son index dans la liste (ici, on suppose que le parent de la carte a data-relationship-id)
    const $card = $(event.currentTarget).closest('.relationship-card');
    const connectionId = $card.data('relationship-id');
    
    // Récupérer les connections actuelles depuis l'acteur
    const connections = duplicate(this.actor.system.relationships.connections);
    // Trouver la connection à modifier (par exemple, en se basant sur connectionId)
    const connectionIndex = connections.findIndex(conn => conn.characterId === connectionId);
    if (connectionIndex === -1) {
      ui.notifications.error("Connection introuvable pour mise à jour de la bio");
      return;
    }
    // Mettre à jour la propriété 'bio'
    connections[connectionIndex].bio = newBio;
    
    // Sauvegarder la modification dans l'acteur
    await this.actor.update({ "system.relationships.connections": connections });
    
    // Mettre à jour l'affichage
    $display.html(newBio + '<i class="fas fa-pencil-alt connection-bio-edit-icon" title="Edit Bio"></i>');
    $textarea.addClass('hidden');
    $display.removeClass('hidden');
    
    // Réattacher le listener sur la nouvelle icône
    $display.find('.connection-bio-edit-icon').on('click', (e) => {
      const $cont = $(e.currentTarget).closest('.connection-bio-container');
      $cont.find('.connection-bio-display').addClass('hidden');
      $cont.find('.connection-bio-edit').removeClass('hidden').focus();
    });
  });
  
  // Optionnel : sauvegarder avec Ctrl+Enter dans le textarea
  html.find('.connection-bio-edit').on('keydown', (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      $(event.currentTarget).blur();
    }
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
    if (!characterActor) return null;
  
    const groupLeaderId = characterActor.system.relationships.currentGroupLeader;
    if (!groupLeaderId) return null;
  
    const groupLeader = game.actors.get(groupLeaderId);
    if (!groupLeader) return null;
  
    const groupMembers = groupLeader.system.relationships.characterGroup.members || [];
    const validMembers = groupMembers
      .map(memberId => game.actors.get(memberId))
      .filter(memberActor => memberActor);
  
    const missingConnections = await this.checkRelationshipsWithinGroup(characterId);
  
    return {
      leaderId: groupLeaderId,
      leaderName: groupLeader.name,
      members: validMembers,
      currentGroupSynergy: groupLeader.system.relationships.characterGroup.baseGroupSynergy || 0,
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
        
        // Vérifier si le groupe personnel a été vidé
        if (this.system.relationships.characterGroup.members.length <= 1) {

          // Restaurer le ghost_member
          this.system.relationships.characterGroup.members = [this.id, "ghost_member"];
  
          await this.update({
            'system.relationships.characterGroup.members': this.system.relationships.characterGroup.members
          });
        }
      }

      // 🔄 Sauvegarde du groupe personnel AVANT de quitter
if (this.system.relationships.characterGroup.id) {  
  await this.update({
      'system.relationships.characterGroup': this.system.relationships.characterGroup
  }).then(() => {

  }).catch(err => {
      console.error(`❌ [ERROR] Impossible de sauvegarder le groupe personnel de "${this.name}"`, err);
  });
}
  
      await this.update({
        'system.relationships.currentGroup': newGroupId,
        'system.relationships.characterGroup.isInHisOwnGroup': newGroupId === this.system.relationships.characterGroup.id
      });
  

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

          }
  
          await oldGroupOwner.update({
            'system.relationships.characterGroup.members': updatedMembers
          });
        }
      }

      
      this.render(false);
  
    } catch (error) {
      ui.notifications.error('Une erreur est survenue lors du changement de groupe');
    }
  }
  
  async checkRelationshipsWithinGroup(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return null;
  
    const groupLeaderId = actor.system.relationships.currentGroupLeader;
    if (!groupLeaderId) return null;
  
    const groupLeader = game.actors.get(groupLeaderId);
    if (!groupLeader) return null;
  
    const members = groupLeader.system.relationships.characterGroup.members;
    if (!members || members.length === 0) return null;
  
    const missingConnections = [];
    for (const memberId of members) {
      const memberActor = game.actors.get(memberId);
      if (!memberActor || memberId === actorId) continue;
  
      const hasConnection = actor.system.relationships.connections.some(
        conn => conn.characterId === memberId
      );
  
      if (!hasConnection) {
        missingConnections.push({
          from: actor.name,
          to: memberActor.name
        });
      }
    }
  
    return missingConnections;
  }



  async updateAffinityValue(index, newValue) {
    const connections = [...this.actor.system.relationships.connections];
    if (connections[index]) {
      connections[index].affinity.value = newValue;
  
      // Recalculer immédiatement la nouvelle discordValue
      const dynamicValue = parseInt(connections[index].dynamic.value) || 0;
      connections[index].discordValue = newValue + dynamicValue;  // 🔥 Plus clair
  
      await this.actor.update({ "system.relationships.connections": connections });
    }
  }
  
  async updateDynamicValue(index, newValue) {
    const connections = [...this.actor.system.relationships.connections];
    if (connections[index]) {
      connections[index].dynamic.value = newValue;
  
      // Recalculer immédiatement la nouvelle discordValue
      const affinityValue = parseInt(connections[index].affinity.value) || 0;
      connections[index].discordValue = affinityValue + newValue;  // 🔥 Plus clair
  
      await this.actor.update({ "system.relationships.connections": connections });
    }
  }
  

  calculateDiscordValue() {
    const connections = this.actor.system.relationships.connections;
    connections.forEach(connection => {
      const affinityValue = Number(connection.affinity.value);
      const dynamicValue = Number(connection.dynamic.value);
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

 async handleGroupWith() {
  // Récupérer tous les acteurs
  const actors = game.actors;
  const currentLeaderId = this.actor.system.relationships.currentGroupLeader;
  const isInOwnGroup = this.actor.system.relationships.currentGroupLeader === this.actor.id;

  // Récupérer tous les groupes disponibles avec les filtres
  const availableGroups = [];
  for (let actor of actors) {
    
    // Vérifier si l'acteur peut être un leader de groupe
    if (
      actor.id !== currentLeaderId && 
      actor.id !== this.actor.id && 
      actor.system.relationships.characterGroup.members.length > 1
    ) {
      availableGroups.push({
        leaderId: actor.id,
        name: actor.system.relationships.characterGroup.name,
        members: actor.system.relationships.characterGroup.members,
        leader: actor
      });
    }
  }

  if (availableGroups.length === 0) {
    ui.notifications.warn("No group available");
    return;
  }

  const dialog = new Dialog({
    title: "Join a Group",
    content: `
      <form>
        <div class="available-groups-grid">
          ${availableGroups.map(group => {
            const members = group.members.map(id => game.actors.get(id)).filter(Boolean);
            return `
              <div class="group-card" data-leader-id="${group.leaderId}">
                <div class="group-header">
                  <h3>${group.name}</h3>
                </div>
                <div class="group-members-avatars">
                  ${members.map(member => `
                    <div class="member-avatar" title="${member.name}">
                      <img src="${member.img || 'icons/svg/mystery-man.svg'}" alt="${member.name}"/>
                    </div>
                  `).join('')}
                </div>
                <button class="join-group-btn" type="button" data-leader-id="${group.leaderId}">
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
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .group-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .group-header h3 {
          margin: 0;
          font-size: 1.2em;
          color: #4b4b4b;
          font-weight: bold;
        }

        .group-members-avatars {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          flex: 1;
          margin: 1rem 0;
        }

        .member-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #4b4b4b;
          transition: transform 0.2s;
        }

        .member-avatar:hover {
          transform: scale(1.1);
          z-index: 1;
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
          transition: background 0.2s, transform 0.1s;
          width: 100%;
          font-weight: bold;
        }

        .join-group-btn:hover {
          background: #666;
          transform: translateY(-1px);
        }

        .join-group-btn:active {
          transform: translateY(1px);
        }

        .join-group-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      </style>
    `,
    buttons: {
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: "Close"
      }
    },
    render: (html) => {
      html.on('click', '.join-group-btn', async (event) => {
        const leaderId = event.currentTarget.dataset.leaderId;
        
        try {
          await this.actor.changeGroup(leaderId);
          const targetLeader = game.actors.get(leaderId);
          
          if (targetLeader) {
            ui.notifications.info(
              `${this.actor.name} a rejoint "${targetLeader.system.relationships.characterGroup.name}"`
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
    if (!this.actor.system.relationships) {
      console.error(`❌ [ERROR] relationships introuvable pour "${this.actor.name}" !`);
      return ui.notifications.error(`Erreur : Impossible de récupérer les relations du personnage.`);
    }

    const currentLeaderId = this.actor.system.relationships.currentGroupLeader;

    // Si déjà dans son groupe personnel
    if (currentLeaderId === this.actor.id) {
      ui.notifications.info(`${this.actor.name} est déjà dans son groupe personnel.`);
      return;
    }

    // Retirer l'acteur de son groupe actuel
    if (currentLeaderId) {
      const oldLeader = game.actors.get(currentLeaderId);
      if (oldLeader) {
        let oldMembers = [...oldLeader.system.relationships.characterGroup.members];
        oldMembers = oldMembers.filter(memberId => memberId !== this.actor.id);

        if (oldMembers.length === 0) {
          oldMembers.push("ghost_member");
        }

        await oldLeader.update({
          "system.relationships.characterGroup.members": oldMembers
        });
      }
    }

    // Vérifier si l'acteur est dans son propre groupe
    let personalGroupMembers = [...this.actor.system.relationships.characterGroup.members];
    if (!personalGroupMembers.includes(this.actor.id)) {
      personalGroupMembers.push(this.actor.id);
    }
    if (!personalGroupMembers.includes("ghost_member")) {
      personalGroupMembers.push("ghost_member");
    }

    // Mise à jour de l'actor
    await this.actor.update({
      "system.relationships.currentGroupLeader": this.actor.id,
      "system.relationships.characterGroup.members": personalGroupMembers,
      "system.relationships.characterGroup.isInHisOwnGroup": true
    });


    ui.notifications.info(`${this.actor.name} est retourné dans son groupe personnel.`);

  } catch (error) {
    console.error(`❌ [ERROR] Une erreur est survenue:`, error);
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
  
  updateDiscordValue(event) {
    const element = $(event.currentTarget).closest('.relationship-card');

    // ✅ Mise à jour des labels d'affinité et de dynamique
    element.find('.affinity-column label').removeClass('checked');
    element.find('.affinity-column input[type="radio"]:checked').closest('label').addClass('checked');

    element.find('.dynamic-column label').removeClass('checked');
    element.find('.dynamic-column input[type="radio"]:checked').closest('label').addClass('checked');

    // ✅ Récupération des valeurs sélectionnées
    const affinity = parseInt(element.find('.affinity-column input[type="radio"]:checked').val()) || 0;
    const dynamic = parseInt(element.find('.dynamic-column input[type="radio"]:checked').val()) || 0;
    const discordValue = affinity + dynamic;
    const discordModifier = Math.ceil(discordValue / 2);

    // 🔄 Mise à jour de l'affichage
    element.find('.discord-value p:first-child').text(discordValue);
    element.find('.discord-value .discord-modifier').text(`Modifier: ${discordModifier}`);

    // ✅ Récupération de l'ID de la relation
    const relationshipId = element.data('relationship-id');
   

    const updatedConnections = JSON.parse(JSON.stringify(this.actor.system.relationships.connections));
    const relationshipIndex = updatedConnections.findIndex(c => c.characterId === relationshipId);

    if (relationshipIndex !== -1) {
        updatedConnections[relationshipIndex].affinity.value = affinity;
        updatedConnections[relationshipIndex].dynamic.value = dynamic;
        updatedConnections[relationshipIndex].discordValue = discordValue;
        updatedConnections[relationshipIndex].discordModifier = discordModifier; // ✅ Mise à jour du modifier
    }

    // ✅ Mise à jour des données de l'actor
    this.actor.update({
        "system.relationships.connections": updatedConnections,
        "system.relationships.discordModifier": discordModifier // ✅ Sauvegarde correcte du modifier
    });

    this.updateSupportDiceWithModifier(relationshipId, discordModifier);
    this.render(false);
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
  
  updateSupportDiceWithModifier(targetId, modifier) {

    // Ne pas relire depuis this.actor.system.relationships.connections
    // Convertir si nécessaire
    modifier = Number(modifier);
    let activeType;
    switch (modifier) {
      case 0:
        activeType = "critical";
        break;
      case 1:
        activeType = "bonus";
        break;
      case 2:
        activeType = "neutral";
        break;
      case 3:
        activeType = "malus";
        break;
      default:
        activeType = null;
    }

    if (!activeType) return;
    
    const $card = this.element.find(`.relationship-card[data-relationship-id="${targetId}"]`);
    if (!$card.length) {
      console.warn(`DEBUG: Carte non trouvée pour ${targetId}`);
      return;
    }
    const $container = $card.find('.support-dice-container');
    $container.empty();
    
    const $die = $(`<div class="support-die ${activeType}" data-target="${targetId}" data-type="${activeType}" style="cursor: pointer;">${activeType.charAt(0).toUpperCase()}</div>`);
    $die.on("click", async () => {
      const result = await rollDie(activeType);
      this.displaySupportMessage(activeType, result, targetId);
    });
    $container.append($die);
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

  updateSupportDice(targetId) {
  
    const $card = this.element.find(`.relationship-card[data-relationship-id="${targetId}"]`);
    if (!$card.length) {
      console.warn(`DEBUG: Carte de relation avec l'ID ${targetId} introuvable !`);
      return;
    }
  
    const $container = $card.find('.support-dice-container');
    if (!$container.length) {
      console.warn("DEBUG: Conteneur .support-dice-container introuvable dans cette carte !");
      return;
    }
  
    $container.empty();
  
    // Récupérer le modificateur depuis les données de l'acteur
    let modifier = this.actor.system.relationships.connections.find(c => c.characterId === targetId)?.discordModifier;
    modifier = Number(modifier);
  
    let activeType;
    switch (modifier) {
      case 0:
        activeType = "critical";
        break;
      case 1:
        activeType = "bonus";
        break;
      case 2:
        activeType = "neutral";
        break;
      case 3:
        activeType = "malus";
        break;
      default:
        activeType = null;
    }
  
    if (activeType) {
      const $die = $(`<div class="support-die ${activeType}" data-target="${targetId}">${activeType.charAt(0).toUpperCase()}</div>`);
      $die.css("cursor", "pointer");
      $die.on("click", async () => {
        const result = await rollDie(activeType);
        this.displaySupportMessage(activeType, result, targetId);
      });
      $container.append($die);
    } else {
      console.log(`DEBUG: Aucun dé ajouté pour ${targetId} avec modifier: ${modifier}`);
    }
  }
  
  
  /**
   * Renvoie la couleur associée au type de dé.
   * @param {string} dieType - Le type de dé ("malus", "neutral", "bonus", "critical").
   * @returns {string} La couleur associée.
   */
  getDieColor(dieType) {
    switch (dieType.toLowerCase()) {
      case "malus":
        return "#aecbfa"; // Exemple : rouge
      case "neutral":
        return "#fef49c"; // Exemple : jaune clair
      case "bonus":
        return "#81c995"; // Exemple : vert
      case "critical":
        return "#f28b82"; // Exemple : rose/rouge clair
      default:
        return "#000";    // Noir par défaut
    }
  }
  
  /**
   * Renvoie le chemin de l'icône associé au résultat du dé.
   * @param {string} result - Le résultat obtenu ("Gain", "Nothing", "Setback").
   * @returns {string} Le chemin de l'icône.
   */
  getIconPathForResult(result) {
    const iconMap = {
      "Nothing": "systems/weave_of_echoes/assets/icons/nothingIcon.svg",
      "Gain": "systems/weave_of_echoes/assets/icons/gainIcon.svg",
      "Setback": "systems/weave_of_echoes/assets/icons/setbackIcon.svg"
    };
  
    if (!iconMap[result]) {
      console.error(`⚠️ Erreur: Aucun chemin d'icône défini pour "${result}"`);
    }
  
    return iconMap[result] || "systems/weave_of_echoes/module/icons/defaultIcon.svg";
  }
  
  /**
   * Affiche dans le chat un message formaté indiquant que l'acteur soutient une cible.
   * Le message sera du type :
   *    ActorName supports TargetActorName : [Icon] Result
   *
   * @param {string} dieType - Le type de dé utilisé ("malus", "neutral", "bonus", "critical").
   * @param {string} result - Le résultat obtenu ("Gain", "Nothing", "Setback").
   * @param {string} targetId - L'id de l'acteur cible (récupéré depuis data-relationship-id).
   */
 

  

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
            iconPath = 'systems/weave_of_echoes/assets/icons/setbackIcon.svg';
            break;
        case 'gain':
            color = '#2a9d8f'; 
            iconPath = 'systems/weave_of_echoes/assets/icons/gainIcon.svg';
            break;
        case 'nothing':
        case 'neutral':
            color = '#8f8f8f';
            iconPath = 'systems/weave_of_echoes/assets/icons/nothingIcon.svg';
            break;
        default:
            console.error(`Icône non trouvée pour '${result}', utilisation de l'icône par défaut`);
            color = '#f4a261';
            iconPath = 'systems/weave_of_echoes/assets/icons/defaultIcon.svg';
    }

    // Retourne directement un élément HTML <img> plutôt que juste le chemin
    return `
      <img src="${iconPath}" 
           alt="${result}" 
           class="support-dice-icon"
           style="width:24px;height:24px;vertical-align:middle;"/> 
      <span class="result-${result}">${result.charAt(0).toUpperCase() + result.slice(1)}</span>
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

  getTargetName() {
    return "Target Actor"; // À remplacer par la logique réelle pour récupérer le bon nom
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

  // Attendre un tick pour laisser le temps à la mise à jour de se propager
  await new Promise(resolve => setTimeout(resolve, 100));
  await this.actor.checkAndPropagateGroupTies();
  this.render();
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

function getDieTypeFromModifier(modifier) {
  switch (modifier) {
    case 0: return "critical";
    case 1: return "bonus";
    case 2: return "neutral";
    case 3: return "malus";
    default: return "";
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



if (!Handlebars.helpers.math) {
  Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
      lvalue = parseFloat(lvalue);
      rvalue = parseFloat(rvalue);

      if (isNaN(lvalue) || isNaN(rvalue)) return 0; // ✅ Vérification anti-NaN

      switch (operator) {
          case "+": return lvalue + rvalue;
          case "-": return lvalue - rvalue;
          case "*": return lvalue * rvalue;
          case "/": return rvalue !== 0 ? lvalue / rvalue : 0; // ✅ Évite la division par zéro
          case "%": return lvalue % rvalue;
          case "ceil": return Math.ceil(lvalue / rvalue);
          case "floor": return Math.floor(lvalue / rvalue);
          default: return 0;
      }
  });
}
