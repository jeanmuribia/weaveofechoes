import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

export class WoeActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['weave-of-echoes', 'sheet', 'actor'],
      width: 600,
      height: 600,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.tab-content',
          initial: 'profile' // Default tab is the Profile tab
        },
      ],
    });
  }

  get template() {
    return `systems/weave_of_echoes/templates/actor/actor-character-sheet.hbs`;
  }

  async getData() {
    const context = super.getData();
    const actorData = this.document.toObject(false);
    context.system = actorData.system;
    context.actorName = this.actor.name;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Built-in tab navigation (Foundry's system will handle the tab changes)
    
    // Save Biography
    html.find('#biography').on('blur', async (event) => {
      const biography = html.find('#biography').val();
      await this.actor.update({ 'system.biography': biography });
    });

    // Save Private Notes
    html.find('#private-notes').on('blur', async (event) => {
      const privateNotes = html.find('#private-notes').val();
      await this.actor.update({ 'system.privateNotes': privateNotes });
    });

    // Initialize Stamina Max to 4 if undefined
    if (!this.actor.system.stamina.max || isNaN(this.actor.system.stamina.max)) {
      this.actor.update({ "system.stamina.max": 4 });
    }

    // Handle name editing (via label click)
    html.find('#name-label').on('click', (event) => {
      html.find('#actor-name').hide();
      html.find('#name-edit').prop('disabled', false).show().focus();
    });

    html.find('#name-edit').on('blur', async (event) => {
      const newName = html.find('#name-edit').val();
      if (newName.trim()) {
        await this.actor.update({ "name": newName });
        html.find('#actor-name').text(newName).show();
      } else {
        html.find('#actor-name').show();
      }
      html.find('#name-edit').hide();
    });

    // Handle Current Stamina increment and decrement
    html.find('#stamina-decrease').on('click', async (event) => {
      let currentStamina = parseInt(html.find('#current-stamina-view').text());
      let maxStamina = this.actor.system.stamina.max || 4;

      if (currentStamina > 0) {
        currentStamina--;
        await this.actor.update({ "system.stamina.current": currentStamina });
        html.find('#current-stamina-view').text(currentStamina);
      }
    });

    html.find('#stamina-increase').on('click', async (event) => {
      let currentStamina = parseInt(html.find('#current-stamina-view').text());
      let maxStamina = this.actor.system.stamina.max || 4;

      if (currentStamina < maxStamina) {
        currentStamina++;
        await this.actor.update({ "system.stamina.current": currentStamina });
        html.find('#current-stamina-view').text(currentStamina);
      }
    });

    // Handle editing of Stamina Max (via label click)
    html.find('#stamina-label').on('click', (event) => {
      html.find('#stamina-max-view').hide();
      html.find('#stamina-max-edit').show().focus();
    });

    html.find('#stamina-max-edit').on('blur', async (event) => {
      let newStaminaMax = parseInt(html.find('#stamina-max-edit').val());
      if (!newStaminaMax || isNaN(newStaminaMax)) {
        newStaminaMax = 4;
      }

      await this.actor.update({
        "system.stamina.max": newStaminaMax,
        "system.stamina.current": Math.min(this.actor.system.stamina.current, newStaminaMax)
      });

      html.find('#stamina-max-view').text(newStaminaMax).show();
      html.find('#current-stamina-view').text(this.actor.system.stamina.current).show();
      html.find('#stamina-max-edit').hide();
    });

    // Handle element editing (via label click)
    html.find('#element-label').on('click', (event) => {
      html.find('#element-view').hide();
      html.find('#element-edit').show().focus();
    });

    html.find('#element-edit').on('blur', async (event) => {
      const newElement = html.find('#element-edit').val();
      await this.actor.update({ "system.element.value": newElement });
      html.find('#element-view').text(newElement).show();
      html.find('#element-edit').hide();
    });

    // Enable temper and attributes edit
    this.enableEditOnClick(html, 'fire');
    this.enableEditOnClick(html, 'water');
    this.enableEditOnClick(html, 'earth');
    this.enableEditOnClick(html, 'air');
    this.enableEditOnClick(html, 'mind');
    this.enableEditOnClick(html, 'body');
    this.enableEditOnClick(html, 'soul');
    this.enableEditOnClick(html, 'martial');
    this.enableEditOnClick(html, 'elementary');
    this.enableEditOnClick(html, 'rhetoric');

    // Manage wounds for all attributes
    this.manageWoundsListeners(html, 'body');
    this.manageWoundsListeners(html, 'mind');
    this.manageWoundsListeners(html, 'soul');
    this.manageWoundsListeners(html, 'martial');
    this.manageWoundsListeners(html, 'elementary');
    this.manageWoundsListeners(html, 'rhetoric');


    //DiceListeners
    html.find('#malusDie').on('click', () => {
      rollDie("malus");  
     });
    html.find('#neutralDie').on('click', () => {
     rollDie("neutral");  
    });
    html.find('#bonusDie').on('click', () => {
      rollDie("bonus"); 
     });
     html.find('#criticalDie').on('click', () => {
      rollDie("critical");  
     });
  }

  

  enableEditOnClick(html, field) {
    const labelSelector = `#${field}-label`;
    const viewSelector = `#${field}-view`;
    const editSelector = `#${field}-edit`;

    html.find(labelSelector).on('click', (event) => {
      html.find(viewSelector).hide();
      html.find(editSelector).prop('disabled', false).show().focus();
    });

    html.find(editSelector).on('blur', async (event) => {
      const newValue = html.find(editSelector).val();
      let updateData = {};
      if (['fire', 'water', 'earth', 'air'].includes(field)) {
        updateData[`system.tempers.${field}.value`] = newValue;
      } else {
        // Update the baseValue and reset the wounds and current value
        updateData[`system.attributes.${field}.baseValue`] = newValue;
        updateData[`system.attributes.${field}.currentValue`] = newValue;
        updateData[`system.attributes.${field}.wounds`] = {
          wound1: false,
          wound2: false,
          wound3: false
        };
      }

      // Update the actor data
      await this.actor.update(updateData);

      // Update the displayed value
      html.find(viewSelector).text(newValue).show();
      html.find(editSelector).hide();
    });
  }

  manageWoundsListeners(html, attribute) {
    const attr = this.actor.system.attributes[attribute];
    const wound1 = html.find(`#${attribute}-wound1`);
    const wound2 = html.find(`#${attribute}-wound2`);
    const wound3 = html.find(`#${attribute}-wound3`);

    // Initial checkbox management
    this.manageWoundCheckboxes(attribute, wound1, wound2, wound3);

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

  async updateAttributeCurrentValue(attribute) {
    const attr = this.actor.system.attributes[attribute];
    let currentValue = attr.baseValue;

    if (attr.wounds.wound1) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound2) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound3) currentValue = this.degradeAttributeValue(currentValue);

    await this.actor.update({ [`system.attributes.${attribute}.currentValue`]: currentValue });

    const wound1 = $(`#${attribute}-wound1`);
    const wound2 = $(`#${attribute}-wound2`);
    const wound3 = $(`#${attribute}-wound3`);

    this.manageWoundCheckboxes(attribute, wound1, wound2, wound3);
  }

  degradeAttributeValue(value) {
    switch (value) {
      case 'critical':
        return 'bonus';
      case 'bonus':
        return 'neutral';
      case 'neutral':
        return 'malus';
      case 'malus':
        return 'malus';
      default:
        return value;
    }
  }

  
}

let rollDie = async (type) => {
  // Roll a single d12 asynchronously
  let roll = new Roll("1d12");
  await roll.evaluate();  // Ensure asynchronous evaluation

  let dieValue = roll.total; // The result of the d12 roll
  let result;

  // Determine the result based on the dice type and dieValue
  switch (type) {
    case "malus":
      if (dieValue >= 1 && dieValue <= 7) {
        result = 1; // Setback
      } else if (dieValue >= 8 && dieValue <= 11) {
        result = 2; // Stalemate
      } else {
        result = 3; // Gain
      }
      break;

    case "neutral":
      if (dieValue >= 1 && dieValue <= 3) {
        result = 1; // Setback
      } else if (dieValue >= 4 && dieValue <= 9) {
        result = 2; // Stalemate
      } else {
        result = 3; // Gain
      }
      break;

    case "bonus":
      if (dieValue >= 1 && dieValue <= 2) {
        result = 1; // Setback
      } else if (dieValue >= 3 && dieValue <= 7) {
        result = 2; // Stalemate
      } else {
        result = 3; // Gain
      }
      break;

    case "critical":
      if (dieValue === 1) {
        result = 1; // Setback
      } else if (dieValue >= 2 && dieValue <= 5) {
        result = 2; // Stalemate
      } else {
        result = 3; // Gain
      }
      break;

    default:
      console.error("Unknown dice type");
      return;
  }

  // Display the result in the chat after evaluating the roll
  displayRollResultsInChat(result);
};

// Function to display results in the chat based on the roll result
function displayRollResultsInChat(result) {
  let resultLabel;
  
  // Assign labels based on the result value (1 = Setback, 2 = Stalemate, 3 = Gain)
  if (result === 1) {
    resultLabel = "Setback";
  } else if (result === 2) {
    resultLabel = "Stalemate";
  } else if (result === 3) {
    resultLabel = "Gain";
  } else {
    resultLabel = "Unknown";  // Just in case something unexpected happens
  }

  // Create the chat message
  ChatMessage.create({
    content: `Roll Result: ${resultLabel}`,
    speaker: ChatMessage.getSpeaker(),
  });
}
