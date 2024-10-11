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

Hooks.on('updateSynergyGroup', (tracker) => {
  game.actors.forEach(actor => {
    if (actor.sheet && actor.sheet instanceof WoeActorSheet) {
      actor.sheet.render(false);
    }
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
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['weave-of-echoes', 'sheet', 'actor'],
      width: 600,
      height: 600,
      tabs: [
        { navSelector: '.sheet-tabs', contentSelector: '.tab-content', initial: 'profile' },
      ],
    });
  }



  get template() {
    return `systems/weave_of_echoes/templates/actor/actor-character-sheet.hbs`;
  }

  // Prepare data and make sure system values are set correctly
  async getData() {
    const context = super.getData();
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

    //relationship Levels
    context.relationshipLevels = [
      { value: -3, label: "Hatred" },
      { value: -2, label: "Hostility" },
      { value: -1, label: "Displeasure" },
      { value: 0, label: "Indifference" },
      { value: 1, label: "Liking" },
      { value: 2, label: "Friendship" },
      { value: 3, label: "Love" }
    ];

    context.groupMembers = this.getGroupMembers();
  context.currentSynergy = this.getCurrentSynergy();
  context.maxSynergy = this.getMaxSynergy();
  context.maneuverCost = this.maneuverCost;
  console.log("Prepared data:", context);
  return context;

    return context;
  }

  // Activate Listeners for sheet interactions
  activateListeners(html) {
    super.activateListeners(html);

    // Handle name editing
    this.handleNameEditing(html);

    // Handle Stamina interactions (increase, decrease, and max editing)
    this.handleStaminaEditing(html);

    // Handle Element editing
    this.handleElementEditing(html);

    // Enable editing for tempers and attributes
    this.enableAttributeEditing(html);

    // Handle Wound listeners for attributes
    this.manageAttributeWounds(html);

    // Handle trauma (wounds) listeners for tempers
    this.manageTemperTrauma(html);

    // Dice roll event listeners for tempers and attributes
    this.addDiceListeners(html);

    html.find('.character-member-item').on('click', this._onGroupMemberClick.bind(this));;

    //maneuver listener
    html.find('#maneuver-button').on('click', (event) => {
      event.preventDefault();
      this.openManeuverWindow();  // Call the method to open the maneuver modal
    
      html.find('.member-item').click(this._onMemberSelection.bind(this));
      
  });
     
    // Relationship management (view, add, edit, delete)
    this.displayRelationships(html);
    this.addRelationshipListeners(html);

          // Manage wounds for all attributes
      this.manageWoundsListeners(html, 'body');
      this.manageWoundsListeners(html, 'mind');
      this.manageWoundsListeners(html, 'soul');
      this.manageWoundsListeners(html, 'martial');
      this.manageWoundsListeners(html, 'elementary');
      this.manageWoundsListeners(html, 'rhetoric');

        // Trauma listeners for tempers
  html.find('#fire-trauma').on('change', async (event) => {
    const isChecked = html.find('#fire-trauma').is(':checked');
    await this.actor.update({ "system.tempers.fire.wound": isChecked });
    this.render();  // Re-render to update the display
  });

  html.find('#water-trauma').on('change', async (event) => {
    const isChecked = html.find('#water-trauma').is(':checked');
    await this.actor.update({ "system.tempers.water.wound": isChecked });
    this.render();
  });

  html.find('#earth-trauma').on('change', async (event) => {
    const isChecked = html.find('#earth-trauma').is(':checked');
    await this.actor.update({ "system.tempers.earth.wound": isChecked });
    this.render();
  });

  html.find('#air-trauma').on('change', async (event) => {
    const isChecked = html.find('#air-trauma').is(':checked');
    await this.actor.update({ "system.tempers.air.wound": isChecked });
    this.render();
  });

   // Add click listeners for temper rollDie based on currentValue
  html.find('#fire-view').on('click', () => this.rollTemperOrAttribute('fire', 'tempers'));
  html.find('#water-view').on('click', () => this.rollTemperOrAttribute('water', 'tempers'));
  html.find('#earth-view').on('click', () => this.rollTemperOrAttribute('earth', 'tempers'));
  html.find('#air-view').on('click', () => this.rollTemperOrAttribute('air', 'tempers'));

  // Add click listeners for attribute rollDie based on currentValue
  html.find('#body-view').on('click', () => this.rollTemperOrAttribute('body', 'attributes'));
  html.find('#mind-view').on('click', () => this.rollTemperOrAttribute('mind', 'attributes'));
  html.find('#soul-view').on('click', () => this.rollTemperOrAttribute('soul', 'attributes'));
  html.find('#martial-view').on('click', () => this.rollTemperOrAttribute('martial', 'attributes'));
  html.find('#elementary-view').on('click', () => this.rollTemperOrAttribute('elementary', 'attributes'));
  html.find('#rhetoric-view').on('click', () => this.rollTemperOrAttribute('rhetoric', 'attributes'));
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

  
  openManeuverWindow() {
    const content = `
      <div>
        <h3>On which of your attributes are you relying on?</h3>
        <div id="attribute-section">
          <button class="attribute-choice" data-attribute="body">Body</button>
          <button class="attribute-choice" data-attribute="soul">Soul</button>
          <button class="attribute-choice" data-attribute="mind">Mind</button>
          <button class="attribute-choice" data-attribute="martial">Martial</button>
          <button class="attribute-choice" data-attribute="elementary">Elementary</button>
          <button class="attribute-choice" data-attribute="rhetoric">Rhetoric</button>
        </div>

        <h3>What is your current state of mind?</h3>
        <div id="temper-section">
          <button class="temper-choice" data-temper="fire">Fire</button>
          <button class="temper-choice" data-temper="water">Water</button>
          <button class="temper-choice" data-temper="earth">Earth</button>
          <button class="temper-choice" data-temper="air">Air</button>
        </div>

        <h3>Is the context advantageous?</h3>
        <div id="context-section">
          <button class="context-choice" data-context="malus">Detrimental</button>
          <button class="context-choice" data-context="neutral">Neutral</button>
          <button class="context-choice" data-context="bonus">Favorable</button>
          <button class="context-choice" data-context="critical">Highly beneficial</button>
        </div>
      </div>
    `;

    let dialog = new Dialog({
      title: "Maneuver",
      content: content,
      buttons: {
        roll: {
          label: "Please answer all 3 questions.",
          callback: () => this.launchManeuver(),
          disabled: true
        }
      },
      render: (html) => {
        this.disableTraumatizedTempers(html);

        html.find('.attribute-choice').on('click', (event) => {
          this.selectedAttribute = $(event.currentTarget).data('attribute');
          html.find('.attribute-choice').removeClass('selected');
          $(event.currentTarget).addClass('selected');
          this.updateRollButtonState(html);
        });
      
        html.find('.temper-choice').on('click', (event) => {
          this.selectedTemper = $(event.currentTarget).data('temper');
          html.find('.temper-choice').removeClass('selected');
          $(event.currentTarget).addClass('selected');
          this.updateRollButtonState(html);
        });
      
        html.find('.context-choice').on('click', (event) => {
          this.selectedContext = $(event.currentTarget).data('context');
          html.find('.context-choice').removeClass('selected');
          $(event.currentTarget).addClass('selected');
          this.updateRollButtonState(html);
        });
      }
    });

    dialog.render(true);
  }

  updateRollButtonState(html) {
    const isAllSelected = this.selectedAttribute && this.selectedTemper && this.selectedContext;
    const rollButton = html.parents('.dialog').find('button.dialog-button.roll');

    if (isAllSelected) {
      rollButton.prop('disabled', false).html('<i class="fas fa-dice"></i> Roll the dice!');
    } else {
      rollButton.prop('disabled', true).text('Please answer all 3 questions.');
    }
    
    // Force a re-render of the button
    rollButton.trigger('change');
  }

// Disable any traumatized tempers in the maneuver modal
disableTraumatizedTempers(html) {
  const tempers = ['fire', 'water', 'earth', 'air'];
  
  tempers.forEach(temper => {
    if (this.actor.system.tempers[temper].wound) { // If trauma exists for this temper
      const temperButton = html.find(`button[data-temper="${temper}"]`);
      temperButton.prop('disabled', true).addClass('disabled').css({
        'background-color': 'lightgrey',
        'color': 'darkgrey',
        'cursor': 'not-allowed'
      });
    }
  });
}




// Launch the maneuver based on the selected options
async launchManeuver() {
  if (!this.selectedAttribute || !this.selectedTemper || !this.selectedContext) {
    ui.notifications.error("You must answer all three questions.");
    return;
  }

  // Retrieve the current values for the selected attribute, temper, and context
  const attributeValue = this.actor.system.attributes[this.selectedAttribute]?.currentValue;
  const temperValue = this.actor.system.tempers[this.selectedTemper]?.currentValue;

  // Roll the dice for the attribute, temper, and context
  const attributeResult = await rollDie(attributeValue);
  const temperResult = await rollDie(temperValue);
  const contextResult = await rollDie(this.selectedContext);

  // Format the message
  const message = `
    <div class="maneuver-result">
      <span class="maneuver-choices">
        ${this.getColoredLabel(this.selectedAttribute, attributeValue)}, 
        ${this.getColoredLabel(this.selectedTemper, temperValue)} & 
        ${this.getColoredLabel(this.getContextName(this.selectedContext), this.selectedContext)} rolled:
      </span>
      <span class="maneuver-results">
        ${attributeResult}, ${temperResult}, ${contextResult}
      </span>
    </div>
  `;

  // Display the results in the chat
  ChatMessage.create({
    content: message,
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  });

  // Reset selections
  this.selectedAttribute = null;
  this.selectedTemper = null;
  this.selectedContext = null;
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

 // This function adds event listeners for managing wound checkboxes
manageWoundsListeners(html, attribute) {
  const attr = this.actor.system.attributes[attribute];
  const wound1 = html.find(`#${attribute}-wound1`);
  const wound2 = html.find(`#${attribute}-wound2`);
  const wound3 = html.find(`#${attribute}-wound3`);

  // Initial checkbox management
  this.manageWoundCheckboxes(attribute, wound1, wound2, wound3);

  // Add change listeners for each wound checkbox
  wound1.on('change', async (event) => {
    const checked = event.target.checked;
    await this.actor.update({ [`system.attributes.${attribute}.wounds.wound1`]: checked });
    this.updateAttributeCurrentValue(attribute);
  });

  wound2.on('change', async (event) => {
    const checked = event.target.checked;
    await this.actor.update({ [`system.attributes.${attribute}.wounds.wound2`]: checked });
    this.updateAttributeCurrentValue(attribute);
  });

  wound3.on('change', async (event) => {
    const checked = event.target.checked;
    await this.actor.update({ [`system.attributes.${attribute}.wounds.wound3`]: checked });
    this.updateAttributeCurrentValue(attribute);
  });
}

manageWoundCheckboxes(attribute, wound1, wound2, wound3) {
  const attr = this.actor.system.attributes[attribute];
  const wounds = attr.wounds;

  if (attr.baseValue === 'malus') {
    wound1.prop('disabled', true);
    wound2.prop('disabled', true);
    wound3.prop('disabled', true);
  } else if (attr.currentValue === 'malus') {
    if (wounds.wound3) {
      wound1.prop('disabled', true);
      wound2.prop('disabled', true);
      wound3.prop('disabled', false);
    } else if (wounds.wound2) {
      wound1.prop('disabled', true);
      wound2.prop('disabled', false);
      wound3.prop('disabled', true);
    } else if (wounds.wound1) {
      wound1.prop('disabled', false);
      wound2.prop('disabled', true);
      wound3.prop('disabled', true);
    }
  } else {
    if (!wounds.wound1 && !wounds.wound2 && !wounds.wound3) {
      wound1.prop('disabled', false);
      wound2.prop('disabled', true);
      wound3.prop('disabled', true);
    } else if (wounds.wound1 && !wounds.wound2 && !wounds.wound3) {
      wound1.prop('disabled', false);
      wound2.prop('disabled', false);
      wound3.prop('disabled', true);
    } else if (wounds.wound2 && !wounds.wound3) {
      wound1.prop('disabled', true);
      wound2.prop('disabled', false);
      wound3.prop('disabled', false);
    } else if (wounds.wound3) {
      wound1.prop('disabled', true);
      wound2.prop('disabled', true);
      wound3.prop('disabled', false);
    }
  }
}

// This function degrades the value of the attribute as the wounds increase
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
    html.find('#name-label').on('click', () => {
      html.find('#actor-name').hide();
      html.find('#name-edit').prop('disabled', false).show().focus();
    });

    html.find('#name-edit').on('blur', async () => {
      const newName = html.find('#name-edit').val().trim();
      if (newName) {
        await this.actor.update({ "name": newName });
        html.find('#actor-name').text(newName).show();
      } else {
        html.find('#actor-name').show();
      }
      html.find('#name-edit').hide();
    });
  }

  handleStaminaEditing(html) {
    // Decrease stamina
    html.find('#stamina-decrease').on('click', async () => {
      let currentStamina = parseInt(html.find('#current-stamina-view').text());
      if (currentStamina > 0) {
        currentStamina--;
        await this.actor.update({ "system.stamina.current": currentStamina });
        html.find('#current-stamina-view').text(currentStamina);
      }
    });

    // Increase stamina
    html.find('#stamina-increase').on('click', async () => {
      let currentStamina = parseInt(html.find('#current-stamina-view').text());
      const maxStamina = this.actor.system.stamina.max || 4;
      if (currentStamina < maxStamina) {
        currentStamina++;
        await this.actor.update({ "system.stamina.current": currentStamina });
        html.find('#current-stamina-view').text(currentStamina);
      }
    });

    // Edit max stamina
    html.find('#stamina-label').on('click', () => {
      html.find('#stamina-max-view').hide();
      html.find('#stamina-max-edit').show().focus();
    });

    html.find('#stamina-max-edit').on('blur', async () => {
      let newMaxStamina = parseInt(html.find('#stamina-max-edit').val());
      if (isNaN(newMaxStamina)) newMaxStamina = 4;

      await this.actor.update({
        "system.stamina.max": newMaxStamina,
        "system.stamina.current": Math.min(this.actor.system.stamina.current, newMaxStamina)
      });

      html.find('#stamina-max-view').text(newMaxStamina).show();
      html.find('#stamina-max-edit').hide();
      html.find('#current-stamina-view').text(this.actor.system.stamina.current).show();
    });
  }

  handleElementEditing(html) {
    html.find('#element-label').on('click', () => {
      html.find('#element-view').hide();
      html.find('#element-edit').show().focus();
    });

    html.find('#element-edit').on('blur', async () => {
      const newElement = html.find('#element-edit').val();
      await this.actor.update({ "system.element.value": newElement });
      html.find('#element-view').text(newElement).show();
      html.find('#element-edit').hide();
    });
  }

  enableAttributeEditing(html) {
    const fields = ['fire', 'water', 'earth', 'air', 'mind', 'body', 'soul', 'martial', 'elementary', 'rhetoric'];
    fields.forEach(field => {
      const labelSelector = `#${field}-label`;
      const viewSelector = `#${field}-view`;
      const editSelector = `#${field}-edit`;

      html.find(labelSelector).on('click', () => {
        html.find(viewSelector).hide();
        html.find(editSelector).prop('disabled', false).show().focus();
      });

      html.find(editSelector).on('blur', async () => {
        const newValue = html.find(editSelector).val();
        let updateData = {};
        if (['fire', 'water', 'earth', 'air'].includes(field)) {
          updateData[`system.tempers.${field}.baseValue`] = newValue;
          updateData[`system.tempers.${field}.currentValue`] = newValue;
        } else {
          updateData[`system.attributes.${field}.baseValue`] = newValue;
          updateData[`system.attributes.${field}.currentValue`] = newValue;
        }
        await this.actor.update(updateData);
        html.find(viewSelector).text(newValue).show();
        html.find(editSelector).hide();
      });
    });
  }

  manageAttributeWounds(html) {
    const attributes = ['body', 'mind', 'soul', 'martial', 'elementary', 'rhetoric'];
    attributes.forEach(attr => {
      const wound1 = html.find(`#${attr}-wound1`);
      const wound2 = html.find(`#${attr}-wound2`);
      const wound3 = html.find(`#${attr}-wound3`);
      this.manageWoundCheckboxes(attr, wound1, wound2, wound3);

      wound1.on('change', async () => this.updateWoundState(attr, 'wound1', wound1));
      wound2.on('change', async () => this.updateWoundState(attr, 'wound2', wound2));
      wound3.on('change', async () => this.updateWoundState(attr, 'wound3', wound3));
    });
  }

  async updateWoundState(attribute, wound, checkbox) {
    const checked = checkbox.is(':checked');
    await this.actor.update({ [`system.attributes.${attribute}.wounds.${wound}`]: checked });
    this.updateAttributeCurrentValue(attribute);
  }

  async updateAttributeCurrentValue(attribute) {
    const attr = this.actor.system.attributes[attribute];
    let currentValue = attr.baseValue;

    if (attr.wounds.wound1) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound2) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound3) currentValue = this.degradeAttributeValue(currentValue);

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
      html.find(`#${temper}-trauma`).on('change', async () => {
        const isChecked = html.find(`#${temper}-trauma`).is(':checked');
        await this.actor.update({ [`system.tempers.${temper}.wound`]: isChecked });
        this.render();  // Re-render to apply trauma change
      });
    });
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

