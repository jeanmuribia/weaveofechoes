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
  const otherActors = game.actors.filter(a => a.id !== actor.id && a.type === "character");

  // Remove relationships related to deleted actor from other actors
  for (let otherActor of otherActors) {
    const relationships = foundry.utils.duplicate(otherActor.system.relationships || []);
    const updatedRelationships = relationships.filter(rel => rel.characterName !== deletedActorName);

    if (relationships.length !== updatedRelationships.length) {
      await otherActor.update({ 'system.relationships': updatedRelationships });
    }
  }
});

export class WoeActorSheet extends ActorSheet {
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

    // Relationship management (view, add, edit, delete)
    this.displayRelationships(html);
    this.addRelationshipListeners(html);
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

  manageWoundCheckboxes(attribute, wound1, wound2, wound3) {
    const attr = this.actor.system.attributes[attribute];
    const wounds = attr.wounds;

    if (attr.baseValue === 'malus') {
      wound1.prop('disabled', true);
      wound2.prop('disabled', true);
      wound3.prop('disabled', true);
    } else {
      wound1.prop('disabled', false);
      wound2.prop('disabled', false);
      wound3.prop('disabled', false);
    }
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
          <input type="text" class="relationship-input" data-index="${index}" data-field="playerName" value="${rel.playerName || ''}" />
          
          <label>Character:</label>
          <select class="relationship-input" data-index="${index}" data-field="characterName">
            ${this.getAvailableCharactersOptions(rel.characterName || '')} <!-- Ensure it's never undefined -->
          </select>

          <label>Relation:</label>
          <div id="relationship-level">
            ${this.getRelationshipLevelOptions(rel.relationshipLevel || 0, index)} <!-- Ensure it's never undefined -->
          </div>
          
          <button class="delete-relationship" data-index="${index}">Delete</button>
        </div>`;
      relationshipList.append(relationshipHtml);
    });
}

  addRelationshipListeners(html) {
    // Add new relationship
    html.find('#add-relationship').on('click', async () => {
      const relationships = this.actor.system.relationships || [];
      relationships.push({
        playerName: '',
        characterName: '',  // Ensure characterName is always initialized
        relationshipLevel: 0
      });
      await this.actor.update({ 'system.relationships': relationships });
      this.render();
    });
    
    // Update relationships
    html.on('change', '.relationship-input', async (event) => {
      const index = $(event.currentTarget).data('index');
      const field = $(event.currentTarget).data('field');
      const value = $(event.currentTarget).val();
      const relationships = foundry.utils.duplicate(this.actor.system.relationships);
      relationships[index][field] = field === 'relationshipLevel' ? parseInt(value) : value;
      await this.actor.update({ 'system.relationships': relationships });
      this.render();
    });

    // Delete a relationship
    html.on('click', '.delete-relationship', async (event) => {
      const index = $(event.currentTarget).data('index');
      if (confirm("Are you sure you want to delete this relationship?")) {
        const relationships = foundry.utils.duplicate(this.actor.system.relationships);
        relationships.splice(index, 1);
        await this.actor.update({ 'system.relationships': relationships });
        this.render();
      }
    });
  }

  getAvailableCharactersOptions(selectedCharacterName) {
    // Initialize the selectedCharacterName in case it's undefined
     selectedCharacterName = selectedCharacterName || '';
  
    const currentActorName = this.actor.name;
    const allCharacters = game.actors.filter(actor => actor.type === "character");
    const existingRelationships = this.actor.system.relationships.map(rel => rel.characterName);
  
    const availableCharacters = allCharacters.filter(char => 
      !existingRelationships.includes(char.name) || char.name === selectedCharacterName
    ).filter(char => char.name !== currentActorName);
  
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
    const levels = [-3, -2, -1, 0, 1, 2, 3];
    return levels.map(level => `
      <label><input type="radio" class="relationship-input" data-index="${index}" data-field="relationshipLevel" name="relationship-level-${index}" value="${level}" ${level === selectedLevel ? 'checked' : ''}> ${level}</label>
    `).join('');
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

  return result;
}

function displayRollResultsInChat(capitalizedType, result) {
  ChatMessage.create({
    content: `${capitalizedType} rolled: ${result}`,
    speaker: ChatMessage.getSpeaker(),
  });
}
