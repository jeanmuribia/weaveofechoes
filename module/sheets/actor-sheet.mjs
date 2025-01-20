import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

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

Hooks.on("createActor", async (actor, options, userId) => {
  // Add new character to the available list of characters for relationships
  if (actor.type === "character") {
      // Nothing to update here, characters are automatically part of the available pool
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
      width:900,
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
    const context = await super.getData();
    const actorData = this.document.toObject(false);

    // Ensure tempers are initialized with baseValue and currentValue
    ['fire', 'water', 'earth', 'air'].forEach(temper => {
      if (!actorData.system.tempers[temper].baseValue) actorData.system.tempers[temper].baseValue = 'neutral';
      if (!actorData.system.tempers[temper].currentValue) actorData.system.tempers[temper].currentValue = 'neutral';
    });

    // Available actors for relationship dropdown
    context.actors = game.actors.filter(actor => actor.id !== this.actor.id && actor.type === "character");
    context.system = actorData.system;
    context.actorName = this.actor.name;

    context.isNotInGroup = !context.currentSynergy && !context.maxSynergy;

    // Relationship Levels
    context.relationshipLevels = [
      { value: -3, label: "Hatred" },
      { value: -2, label: "Hostility" },
      { value: -1, label: "Displeasure" },
      { value: 0, label: "Indifference" },
      { value: 1, label: "Liking" },
      { value: 2, label: "Friendship" },
      { value: 3, label: "Love" }
    ];

    // Synergy data
    context.groupMembers = this.getGroupMembers();
    context.currentSynergy = this.getCurrentSynergy();
    context.maxSynergy = this.getMaxSynergy();
    context.maneuverCost = this.calculateManeuverCost();
    context.isSynergyHidden = this.actor.getFlag('weave_of_echoes', 'synergyHidden') || false;

    //focus point
    this._prepareFocusPointsData(context);

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
  

  _prepareFocusPointsData(sheetData) {
    const actorData = sheetData;

    // Ensure focus points data exists
    if (!actorData.system.focusPoints) {
      actorData.system.focusPoints = {
        base: 0,
        current: 0,
        isVisible: false
      };
    }

    sheetData.focusPoints = actorData.system.focusPoints;
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
    
  
    
    // Wounds, Injuries, and Trauma management
    this.handleMasteryLevelEditing(html);
    this._setupAttributeListeners(html);
    this._setupWoundListeners(html);

    this.manageTemperTrauma(html);
  
    // Dice rolling
    this.addDiceListeners(html);
  
    // Group members
    html.find('.character-member-item').on('click', this._onGroupMemberClick.bind(this));
  
    // Maneuver
    html.find('.maneuver-container').on('click', () => { this.openManeuverWindow(); });
  
    // Relationships
    this.displayRelationships(html);
    this.addRelationshipListeners(html);

    html.find('.attribute-tag-field').on('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault(); // Empêche le retour à la ligne
        event.target.blur(); // Simule la fin de l'édition si nécessaire
      }
    });
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
    ['fire', 'water', 'earth', 'air'].forEach(temper => {
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
                        ${['fire', 'water', 'earth', 'air'].map(temper => 
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
  // Attributs
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

  // Tempers
  html.find('.temper-choice').on('click', (event) => {
      const element = $(event.currentTarget);
      const temper = element.data('temper');
      
      element.siblings().removeClass('selected');
      element.addClass('selected');
      
      this.maneuverSelections.temper = temper;
      this.updateDieDisplay(html, 'tempers', temper);
      this.updateFocusRow(html, 'tempers', temper);
      this.checkAndUpdateRollButton(html);
  });

  // Contexte
  html.find('.context-choice').on('click', (event) => {
      const element = $(event.currentTarget);
      const context = element.data('context');
      
      element.siblings().removeClass('selected');
      element.addClass('selected');
      
      this.maneuverSelections.context = context;
      this.updateDieDisplay(html, 'context', context);
      this.checkAndUpdateRollButton(html);
  });

  // Bouton de lancement
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
        const filePicker = new FilePicker({ type: 'image' });
        await filePicker.render(true);
        const newImagePath = filePicker.result; // Utilisez "result" pour le chemin de fichier

        if (newImagePath) {
            const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
            if (validExtensions.some(ext => newImagePath.endsWith(ext))) {
                await this.actor.update({ img: newImagePath });
            } else {
                ui.notifications.error("Invalid image format. Use PNG, JPG, JPEG, or WEBP.");
            }
        }
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
    const tempers = ['fire', 'water', 'earth', 'air'];
  
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

updateFocusPointsFromRelationships() {
  const groupMembers = this.getGroupMembers().map(m => m.name);
  this.calculateBaseFocusPoints(groupMembers);
}

  /**
   * Calcule les Focus Points de base pour l'acteur
   * @param {Array} groupMembers - Les membres du groupe sélectionnés dans le Focus Tracker
   */
  calculateBaseFocusPoints(groupMembers) {
    let baseFocus = 0;
    const relationships = this.actor.system.relationships || [];

    relationships.forEach(relation => {
      if (groupMembers.includes(relation.characterName)) {
        switch (relation.relationshipLevel) {
          case -3: // Hatred
            baseFocus += 3;
            break;
          case -2: // Hostility
            baseFocus += 2;
            break;
          case -1: // Dislike
            baseFocus += 1;
            break;
        }
      }
    });

    this.actor.update({ 
      'system.focusPoints.base': baseFocus,
      'system.focusPoints.current': Math.max(baseFocus, this.actor.system.focusPoints.current)
    });
  }
    /**
   * Modifie les Focus Points actuels
   * @param {number} amount - La quantité à ajouter (ou soustraire si négatif)
   */
    modifyCurrentFocusPoints(amount) {
      const newCurrent = Math.max(0, this.actor.system.focusPoints.current + amount);
      this.actor.update({ 'system.focusPoints.current': newCurrent });
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
      console.log("Current Focus :", currentFocus, "Remaining Focus :", remainingFocus);
  
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
    console.log("Synchronizing focus points:", remainingFocus);

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
  ['fire', 'water', 'earth', 'air'].forEach(temper => {
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
  const nameDisplay = html.find('#actor-name');
  const nameInput = html.find('#name-edit');

  if (!nameDisplay.length || !nameInput.length) {
    console.error("Name editing elements missing in the template.");
    return;
  }

  nameDisplay.on('click', () => {
    nameInput.val(nameDisplay.text().trim()); // Pré-remplir avec la valeur actuelle
    nameDisplay.hide();
    nameInput.prop('disabled', false).show().focus();
  });

  nameInput.on('blur', async () => {
    const newName = nameInput.val().trim();
    if (newName) {
      await this.actor.update({ "name": newName });
      nameDisplay.text(newName).show();
    } else {
      nameDisplay.show();
    }
    nameInput.hide();
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
    ['fire', 'water', 'earth', 'air'].forEach(temper => {
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
    ['malus', 'neutral', 'bonus', 'critical'].forEach(dieType => {
      html.find(`#${dieType}Die`).on('click', () => this.handleSingleDiceRoll(dieType));
    });
  }

  async handleSingleDiceRoll(type) {
    const capitalizedType = toUpperCaseValue(type);
    const result = await rollDie(type);
    this.displayRollResultsInChat(capitalizedType, result);
  }

  displayRelationships(html) {
    const relationships = this.actor.system.relationships || [];
    const relationshipList = html.find('#relationship-list');
    relationshipList.empty();

    relationships.forEach((rel, index) => {
      const relationshipHtml = `
        <div class="relationship-item">
          <label>Player:</label>
          <input type="text" class="relationship-input" data-index="${index}" data-field="playerName" value="${rel.playerName}" />

          <label>Character:</label>
          <span>${rel.characterName}</span>  <!-- Show plain text once character is chosen -->

          <label>Relation:</label>
          <div id="relationship-level">
            ${this.getRelationshipLevelOptions(rel.relationshipLevel, index)}
          </div>
          
          <button class="delete-relationship" data-index="${index}">Delete</button>
        </div>`;
      relationshipList.append(relationshipHtml);
    });

    this.activateRelationshipListeners(html);  // Ensure listeners are activated after rendering
  }

  activateRelationshipListeners(html) {
    const relationships = this.actor.system.relationships || [];
    
    relationships.forEach((rel, index) => {
        // Player Name
        html.find(`input[data-field="playerName"][data-index="${index}"]`)
            .on('change', this._onUpdateRelationship.bind(this));
        
        // Relationship Level
        html.find(`input[name="relationship-level-${index}"]`)
            .on('change', this._onUpdateRelationship.bind(this));
        
        // Delete relationship
        html.find(`.delete-relationship[data-index="${index}"]`)
            .on('click', this._onDeleteRelationship.bind(this));
    });

   
}

async _onUpdateRelationship(event) {
  event.preventDefault();
  const index = event.currentTarget.dataset.index;
  const field = event.currentTarget.dataset.field || 'relationshipLevel';
  const value = field === 'relationshipLevel' ? parseInt(event.currentTarget.value) : event.currentTarget.value;

  const relationships = foundry.utils.deepClone(this.actor.system.relationships);
  relationships[index][field] = value;

  await this.actor.update({ 'system.relationships': relationships });

  // Notifier les trackers de synergie que les relations ont changé
  Hooks.call('updateSynergyTracker', this.actor);

  this.render();
}

async _onDeleteRelationship(event) {
  event.preventDefault();
  const index = event.currentTarget.dataset.index;

  const relationships = foundry.utils.deepClone(this.actor.system.relationships);
  relationships.splice(index, 1);

  await this.actor.update({ 'system.relationships': relationships });

  // Notifier les trackers de synergie que les relations ont changé
  Hooks.call('updateSynergyTracker', this.actor);

  this.render();
}

async addRelationship() {
  const availableCharacters = game.actors.filter(actor => actor.type === "character")
    .filter(char => !this.actor.system.relationships.some(rel => rel.characterName === char.name))
    .filter(char => char.name !== this.actor.name);

  if (availableCharacters.length === 0) {
    ui.notifications.error("You are already tied to every other character.");
    return;
  }

  const characterOptions = availableCharacters.map(char => `<option value="${char.name}">${char.name}</option>`).join('');

  let dialog = new Dialog({
    title: "Choose a Character",
    content: `
      <form>
        <div class="form-group">
          <label for="character">Please choose a character to be tied with:</label>
          <select id="character" name="character">
            ${characterOptions}
          </select>
        </div>
      </form>
    `,
    buttons: {
      add: {
        icon: '<i class="fas fa-check"></i>',
        label: "Add Relationship",
        callback: async (html) => {
          const selectedCharacter = html.find('#character').val();
          if (selectedCharacter) {
            const relationships = foundry.utils.deepClone(this.actor.system.relationships);
            relationships.push({
              playerName: '',
              characterName: selectedCharacter,
              relationshipLevel: 0
            });

            await this.actor.update({ 'system.relationships': relationships });
            this.render();
          }
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "add"
  });

  dialog.render(true);
}



addRelationshipListeners(html) {
  html.find('#add-relationship').on('click', (event) => {
      event.preventDefault();
      this.addRelationship();  // Call the new modal-based method
  });
}

  getAvailableCharactersOptions(selectedCharacterName) {
    // Initialize the selectedCharacterName in case it's undefined
    selectedCharacterName = selectedCharacterName || '';
  
    const currentActorName = this.actor.name;
    const allCharacters = game.actors.filter(actor => actor.type === "character");

    // Filter characters that are already in relationships
    const existingRelationships = this.actor.system.relationships
        .map(rel => rel.characterName)   // Get all related character names
        .filter(name => name);           // Exclude empty names from incomplete relationships


    const availableCharacters = allCharacters
        .filter(char => !existingRelationships.includes(char.name) || char.name === selectedCharacterName)
        .filter(char => char.name !== currentActorName); // Exclude the current actor themselves


    // Build the options HTML for the available characters dropdown
    let options = `<option value="" disabled selected>Choose another character</option>`;
  
    if (availableCharacters.length === 0) {
        options += `<option disabled>No characters available</option>`;
    } else {
        options += availableCharacters.map(char => 
            `<option value="${char.name}" ${char.name === selectedCharacterName ? 'selected' : ''}>${char.name}</option>`
        ).join('');
    }

    return options;
}
  getRelationshipLevelOptions(selectedLevel, index) {
    const levels = [
      { value: -3, label: "Hatred" },
      { value: -2, label: "Hostility" },
      { value: -1, label: "Displeasure" },
      { value: 0, label: "Indifference" },
      { value: 1, label: "Liking" },
      { value: 2, label: "Friendship" },
      { value: 3, label: "Love" }
    ];
    
    return levels.map(level => `
      <label><input type="radio" class="relationship-input" data-index="${index}" 
        data-field="relationshipLevel" name="relationship-level-${index}" 
        value="${level.value}" ${level.value === selectedLevel ? 'checked' : ''}> 
        ${level.label}</label>
    `).join('');
  }

  getGroupMembers() {
    const tracker = this.getAssociatedSynergyTracker();
    if (tracker) {
      return tracker.data.characters
        .filter(char => char !== this.actor.name)
        .map(char => ({
          name: char,
          isSelected: this.selectedMembers ? this.selectedMembers.includes(char) : false
        }));
    }
    return [];
  }

  _onGroupMemberClick(event) {
    const characterName = event.currentTarget.dataset.character;
    const clickedElement = event.currentTarget;
    
    // Toggle la classe 'selected' sur l'élément cliqué
    clickedElement.classList.toggle('selected');
    
    // Mise à jour de la liste des membres sélectionnés
    const index = this.selectedMembers.indexOf(characterName);
    if (index > -1) {
      this.selectedMembers.splice(index, 1);
    } else {
      this.selectedMembers.push(characterName);
    }
  
    this.updateManeuverCost();
    this.render(false);  // Forcer le rendu pour mettre à jour l'interface
  }

  updateManeuverCost() {
    this.maneuverCost = this.calculateManeuverCost();
    this.render(false);
  }

  calculateRelationshipCost(actor1, actor2) {
    // Implémenter la logique de calcul du coût basée sur les relations
    // Ceci est un exemple simplifié, ajustez selon vos règles spécifiques
    const relationship1 = actor1.system.relationships.find(r => r.characterName === actor2.name);
    const relationship2 = actor2.system.relationships.find(r => r.characterName === actor1.name);
    
    if (relationship1 && relationship2) {
      // Exemple de calcul, à ajuster selon vos besoins
      return Math.abs(relationship1.relationshipLevel) + Math.abs(relationship2.relationshipLevel);
    }
    return null;
  }

  getCurrentSynergy() {
    const tracker = this.getAssociatedSynergyTracker();
    return tracker ? tracker.data.currentSynergy : 0;
  }

  getMaxSynergy() {
    const tracker = this.getAssociatedSynergyTracker();
    return tracker ? tracker.data.maxSynergy : 0;
  }

  getManeuverCost() {
    const tracker = this.getAssociatedSynergyTracker();
    return tracker ? tracker.calculateManeuverCost() : 0;
  }

 calculateManeuverCost() {
  
  if (this.selectedMembers.length < 1) return null;

  let synergyCost = 0;
  const transformRelationValue = (value) => {
    switch (value) {
      case 3: return 1;
      case 2: return 2;
      case 1: return 3;
      case 0: return 4;
      case -1: return 5;
      case -2: return 6;
      case -3: return 7;
      default: return 4;
    }
  };

  // Inclure le personnage actuel dans les calculs
  const allMembers = [this.actor, ...this.selectedMembers.map(name => game.actors.getName(name))];

  for (let i = 0; i < allMembers.length; i++) {
    for (let j = i + 1; j < allMembers.length; j++) {
      const member1 = allMembers[i];
      const member2 = allMembers[j];
      
      if (member1 && member2) {
        const relationAB = transformRelationValue(member1.system.relationships.find(rel => rel.characterName === member2.name)?.relationshipLevel || 0);
        const relationBA = transformRelationValue(member2.system.relationships.find(rel => rel.characterName === member1.name)?.relationshipLevel || 0);
        
        synergyCost += relationAB + relationBA;
        
        if (relationAB === relationBA && (relationAB <= 3)) {
          synergyCost -= 2;
        }
      }
    }
  }

  return Math.max(1, synergyCost);
}

  getAssociatedSynergyTracker() {
    for (const trackerId in game.weaveOfEchoes.additionalTrackers) {
      const tracker = game.weaveOfEchoes.additionalTrackers[trackerId];
      if (tracker.data.characters.includes(this.actor.name)) {
        return tracker;
      }
    }
  
    return null;
  }

  _onMemberSelection(event) {
    const characterName = event.currentTarget.dataset.character;
    const tracker = this.getAssociatedSynergyTracker();
    if (tracker) {
      tracker.toggleMemberSelection(characterName);
      this.render(false);
    }
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


