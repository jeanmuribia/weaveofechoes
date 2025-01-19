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

    console.log("Prepared data:", context);
    return context;

   
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
  }

  rollTemperOrAttribute(field, type) {
    let value;
  
    // Get the current value from the temper or attribute
    if (type === 'tempers') {
      value = this.actor.system.tempers[field].currentValue;
    } else if (type === 'attributes') {
      value = this.actor.system.attributes[field].currentValue;
    }
  
    // Log the roll for debugging
    console.log("Rolling die for:", type, field, "with value:", value);
  
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

  async _setupAttributeListeners(html) {
    const attributes = ['body', 'mind', 'soul', 'martial', 'elementary', 'rhetoric'];
    
    attributes.forEach(attr => {
      const injuryCheckbox = html.find(`#${attr}-injury`);
      const baseValue = this.actor.system.attributes[attr].baseValue;
  
      if (baseValue === 'malus') {
        injuryCheckbox.prop('disabled', true)
                      .parent().addClass('disabled')
                      .attr('title', "Malus attribute can't get injured");
        return;
      }
  
      injuryCheckbox.on('click', async event => {
        const isChecked = event.currentTarget.checked;
        
        await this.actor.update({
          [`system.attributes.${attr}.injury`]: isChecked,
          [`system.attributes.${attr}.currentValue`]: isChecked ? 'malus' : baseValue
        });
  
        this.render();
      });
    });
  }

  _setupWoundListeners(html) {
    ['1', '2', '3'].forEach(number => {
      const woundBox = html.find(`.wound-box[data-wound="${number}"]`);
      woundBox.on('click', () => this._handleWoundClick(number));
    });
  }
  
  async _handleWoundClick(number) {
    const wounds = foundry.utils.deepClone(this.actor.system.wounds);
    
    // Vérifier si on peut interagir avec cette wound
    if (!this._canInteractWithWound(number, wounds)) return;
  
    if (wounds[`wound${number}`]) {
      // Unticking
      await this._untickWound(number);
    } else {
      // Ticking
      await this._tickWound(number);
    }
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
  
  async _tickWound(number) {
    const updates = {
      [`system.wounds.wound${number}`]: true
    };
  
    // Dégrader tous les attributs non-malus
    Object.entries(this.actor.system.attributes).forEach(([key, attr]) => {
      if (attr.baseValue !== 'malus' && attr.currentValue !== 'malus') {
        updates[`system.attributes.${key}.currentValue`] = this._degradeValue(attr.currentValue);
      }
    });
  
    await this.actor.update(updates);
  }
  
  async _untickWound(number) {
    const updates = {
      [`system.wounds.wound${number}`]: false
    };
  
    // Améliorer les attributs si possible
    Object.entries(this.actor.system.attributes).forEach(([key, attr]) => {
      if (!attr.injury && attr.baseValue !== 'malus') {
        updates[`system.attributes.${key}.currentValue`] = this._improveValue(attr.currentValue, attr.baseValue);
      }
    });
  
    await this.actor.update(updates);
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


  openManeuverWindow() {
    this.maneuverFocus = this.actor.system.focusPoints.current;
    this.focusPointsUsed = 0;  // Initialize the focus points counter to 0
    const content = `
      <div class="maneuver-modal">
        <h2 class="maneuver-title">Maneuver Launcher</h2>
        
        <div class="maneuver-grid">
          <div class="section attribute-section">
            <h3>On which of your attributes are you relying on?</h3>
            <div id="attribute-section" class="button-group">
              ${['body', 'soul', 'mind', 'martial', 'elementary', 'rhetoric'].map(attr => 
                `<div class="attribute-choice die-${this.getDieType(attr, 'attributes')}" data-attribute="${attr}">
                  <span>${attr}</span>
                </div>`
              ).join('')}
            </div>
            <div class="focus-checkbox-container" id="focus-attributes"></div>
            <div class="die-display" id="attributes-die"></div>
          </div>
  
          <div class="section temper-section">
            <h3>What is your current state of mind?</h3>
            <div id="temper-section" class="button-group">
              ${['fire', 'water', 'earth', 'air'].map(temper => 
                `<div class="temper-choice die-${this.getDieType(temper, 'tempers')}" data-temper="${temper}">
                  <span>${temper}</span>
                </div>`
              ).join('')}
            </div>
            <div class="focus-checkbox-container" id="focus-tempers"></div>
            <div class="die-display" id="tempers-die"></div>
          </div>
  
          <div class="section context-section">
            <h3>Is the context advantageous?</h3>
            <div id="context-section" class="button-group">
              <div class="context-choice die-malus" data-context="malus">Detrimental</div>
              <div class="context-choice die-neutral" data-context="neutral">Neutral</div>
              <div class="context-choice die-bonus" data-context="bonus">Favorable</div>
              <div class="context-choice die-critical" data-context="critical">Highly beneficial</div>
            </div>
            <div class="die-display" id="context-die"></div>
          </div>
        </div>
  
        <div class="footer">
          <div class="focus-counter">
            <span id="maneuver-focus-number">${this.maneuverFocus}</span> focus points remaining
          </div>
          <div class="roll-dice-container">
            <div class="roll-dice disabled">
              <i class="fas fa-dice"></i> 
              <span class="roll-text">Please answer all 3 questions</span>
            </div>
          </div>
        </div>
      </div>
    `;
  
    let dialog = new Dialog({
      title: "Maneuver",
      content: content,
      buttons: {},
      render: (html) => {
        this.disableTraumatizedTempers(html);

         // Handle click events for the checkboxes to track focus points
      html.find('.focus-checkbox').on('change', (event) => {
        if (event.target.checked) {
          this.focusPointsUsed++;  // Increment when checked
        } else {
          this.focusPointsUsed--;  // Decrement when unchecked
        }
        console.log("Focus points used: ", this.focusPointsUsed);  // Debug log to check the counter
      });

        
      html.find('.attribute-choice, .temper-choice').on('click', (event) => {
        const $target = $(event.currentTarget);
        const type = $target.hasClass('attribute-choice') ? 'attributes' : 'tempers';
        const selectedItem = $target.data(type === 'attributes' ? 'attribute' : 'temper');
      
        // Deselect all other elements in the current section
        html.find(`.${type}-choice`).removeClass('active');  // Remove active class from all
        $target.addClass('active');  // Set the clicked one as active
      
        this[type === 'attributes' ? 'selectedAttribute' : 'selectedTemper'] = selectedItem;
        this.updateFocusSection(html, selectedItem, type);
        this.updateDieDisplay(html, type, selectedItem);
        this.updateRollButtonState(html);
      });
  
        html.find('.context-choice').on('click', (event) => {
          event.preventDefault();
          event.stopPropagation(); // Empêche la propagation de l'événement
        
          const selectedContext = $(event.currentTarget).data('context');
          console.log(`Context selected: ${selectedContext}`); // Log le contexte sélectionné
          this.selectedContext = selectedContext;
        
          // Pas de modifications sur les autres sections ici
          this.updateDieDisplay(html, 'context', selectedContext);
          this.updateActiveState(html, '.context-choice', event.currentTarget);
          this.updateRollButtonState(html);
        
          // Aucune manipulation des checkboxes pour le contexte
          console.log('Context click handled: no focus checkboxes should be affected');
        });
  
        // Bouton de lancement
        html.find('.roll-dice').on('click', () => this.launchManeuver());
      },
      close: () => {
        this.selectedAttribute = null;
        this.selectedTemper = null;
        this.selectedContext = null;
        this.selectedAttributeValue = null;
        this.selectedTemperValue = null;
        this.selectedContextValue = null;
        this.focusPointsUsed = 0;  // Reset focus points used on modal close
        this.maneuverFocus = this.actor.system.focusPoints.current; // Reset maneuver focus to current state
      }
    }, {
      width: 600,
      height: 'auto',
      resizable: false
    });
  
    dialog.render(true);
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
      console.log('Context selected: skipping focus section update for other sections');
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
          console.log("Disabled checkbox clicked");
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
  
  updateDieDisplay(html, type, selectedItem, newValue) {
    const dieDisplay = html.find(`#${type}-die`);
    if (dieDisplay.length === 0) {
      console.error(`Die display element not found for ${type}`);
      return;
    }
    
    let dieType = newValue || this.getDieType(selectedItem, type);
    dieType = String(dieType).toLowerCase();
    
    dieDisplay.attr('class', 'die-display die-' + dieType);
    dieDisplay.html(`<i class="fas fa-dice-d20"></i><span>${dieType.charAt(0).toUpperCase() + dieType.slice(1)}</span>`);

    // Update the selected value
    if (type === 'attributes') {
      this.selectedAttribute = selectedItem;
      this.selectedAttributeValue = dieType;
    } else if (type === 'tempers') {
      this.selectedTemper = selectedItem;
      this.selectedTemperValue = dieType;
    } else if (type === 'context') {
      this.selectedContext = selectedItem;
      this.selectedContextValue = dieType;
    }

    this.updateFocusDisplay();
  }

  
 getDieType(type, category) {
  if (category === 'attributes') {
    return this.actor.system.attributes[type]?.currentValue || 'neutral';
  } else if (category === 'tempers') {
    return this.actor.system.tempers[type]?.currentValue || 'neutral';
  } else if (category === 'context') {
    return type;
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
      if (!this.selectedAttribute || !this.selectedTemper || !this.selectedContext) {
        ui.notifications.error("You must answer all three questions.");
        return;
      }
    
      console.log("Selected Attribute:", this.selectedAttribute, "Value:", this.selectedAttributeValue);
      console.log("Selected Temper:", this.selectedTemper, "Value:", this.selectedTemperValue);
      console.log("Selected Context:", this.selectedContext, "Value:", this.selectedContextValue);
    
      const attributeValue = this.selectedAttributeValue;
      const temperValue = this.selectedTemperValue;
      const contextValue = this.selectedContextValue;
    
      // Retrieve focus points used from the stored value during modal interaction
      const usedFocus = this.focusPointsUsed || 0; // Default to 0 if undefined
      console.log("Focus points used during maneuver:", usedFocus);
    
      // Log only if focus points are used
      const focusMessage = usedFocus > 0 ? ` with ${usedFocus} focus points used` : '';
    
      await this.actor.update({ 'system.focusPoints.current': this.maneuverFocus });
    
      const attributeResult = await rollDie(attributeValue);
      const temperResult = await rollDie(temperValue);
      const contextResult = await rollDie(contextValue);
    
      const message = `
        <div class="maneuver-result">
          <span class="maneuver-choices">
            ${this.getColoredLabel(this.selectedAttribute, attributeValue)}, 
            ${this.getColoredLabel(this.selectedTemper, temperValue)} & 
            ${this.getColoredLabel(this.getContextName(this.selectedContext), contextValue)} 
            rolled${focusMessage}:
          </span>
          <span class="maneuver-results">
            ${attributeResult}, ${temperResult}, ${contextResult}
          </span>
        </div>
      `;
    
      ChatMessage.create({
        content: message,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      });
    
      // Reset selections and focus points
      this.selectedAttribute = null;
      this.selectedTemper = null;
      this.selectedContext = null;
    
      // Close the modal and reset focus
      this.closeManeuverModal();
    }
    
    
  
    closeManeuverModal() {
      const modalElement = document.querySelector('.maneuver-modal');
      if (modalElement) {
        const dialogElement = modalElement.closest('.app.dialog');
        if (dialogElement) {
          dialogElement.remove();
        }
      }
    
      // Reset focusPointsUsed when modal is closed
      console.log("Resetting focus points");
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
getColoredLabel(name, type) {
  const capitalizedName = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `<span class="color-${type}">${capitalizedName}</span>`;
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
          console.log(`Temper: ${temper}, Path: ${path}, New Value: ${newValue}`); // Debug
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

    console.log("Existing Relationships:", existingRelationships);

    const availableCharacters = allCharacters
        .filter(char => !existingRelationships.includes(char.name) || char.name === selectedCharacterName)
        .filter(char => char.name !== currentActorName); // Exclude the current actor themselves

    console.log("Available Characters:", availableCharacters);

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
    console.log("Group member clicked:", event.currentTarget.dataset.character);
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
    console.log("Updating maneuver cost");
    this.maneuverCost = this.calculateManeuverCost();
    console.log("New maneuver cost:", this.maneuverCost);
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
  console.log("Selected members:", this.selectedMembers);
  
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

  console.log("Calculated synergy cost:", synergyCost);
  return Math.max(1, synergyCost);
}

  getAssociatedSynergyTracker() {
    for (const trackerId in game.weaveOfEchoes.additionalTrackers) {
      const tracker = game.weaveOfEchoes.additionalTrackers[trackerId];
      if (tracker.data.characters.includes(this.actor.name)) {
        return tracker;
      }
    }
    console.warn(`No associated synergy tracker found for ${this.actor.name}`);
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
      result = (roll.total <= 7) ? "Setback" : (roll.total <= 11) ? "Stalemate" : "Gain";
      break;
    case 'neutral':
      result = (roll.total <= 3) ? "Setback" : (roll.total <= 9) ? "Stalemate" : "Gain";
      break;
    case 'bonus':
      result = (roll.total <= 2) ? "Setback" : (roll.total <= 7) ? "Stalemate" : "Gain";
      break;
    case 'critical':
      result = (roll.total == 1) ? "Setback" : (roll.total <= 5) ? "Stalemate" : "Gain";
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


