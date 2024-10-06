import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

function toUpperCaseValue(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

Handlebars.registerHelper('toUpperCaseValue', function(value) {
  if (typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
});

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
  
    // Ensure tempers are initialized with baseValue and currentValue
    ['fire', 'water', 'earth', 'air'].forEach(temper => {
      if (!actorData.system.tempers[temper].baseValue) {
        actorData.system.tempers[temper].baseValue = 'neutral';
      }
      if (!actorData.system.tempers[temper].currentValue) {
        actorData.system.tempers[temper].currentValue = 'neutral';
      }
    });
  
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

    // Dice Listeners
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

     
    // Add click listeners for temper and attribute rollDie based on currentValue
    html.find('#fire-view').on('click', () => this.rollTemperOrAttribute('fire', 'tempers'));
    html.find('#water-view').on('click', () => this.rollTemperOrAttribute('water', 'tempers'));
    html.find('#earth-view').on('click', () => this.rollTemperOrAttribute('earth', 'tempers'));
    html.find('#air-view').on('click', () => this.rollTemperOrAttribute('air', 'tempers'));

    html.find('#body-view').on('click', () => this.rollTemperOrAttribute('body', 'attributes'));
    html.find('#mind-view').on('click', () => this.rollTemperOrAttribute('mind', 'attributes'));
    html.find('#soul-view').on('click', () => this.rollTemperOrAttribute('soul', 'attributes'));
    html.find('#martial-view').on('click', () => this.rollTemperOrAttribute('martial', 'attributes'));
    html.find('#elementary-view').on('click', () => this.rollTemperOrAttribute('elementary', 'attributes'));
    html.find('#rhetoric-view').on('click', () => this.rollTemperOrAttribute('rhetoric', 'attributes'));
}

  
enableEditOnClick(html, field) {
  const labelSelector = `#${field}-label`;
  const viewSelector = `#${field}-view`;
  const editSelector = `#${field}-edit`;

  html.find(labelSelector).on('click', (event) => {
    console.log("Label clicked:", field);  // Debugging check
    html.find(viewSelector).hide();  // Hide the view
    html.find(editSelector).prop('disabled', false).show().focus();  // Show the input for editing
  });

  html.find(editSelector).on('blur', async (event) => {
    const newValue = html.find(editSelector).val();
    console.log("New value entered:", newValue);  // Debugging check
    
    let updateData = {};

    // Check if the field is a temper or an attribute
    if (['fire', 'water', 'earth', 'air'].includes(field)) {
      // Handle tempers - update both baseValue and currentValue
      updateData[`system.tempers.${field}.baseValue`] = newValue;
      updateData[`system.tempers.${field}.currentValue`] = newValue;
    } else {
      // Handle attributes - update both baseValue and currentValue, and reset wounds
      updateData[`system.attributes.${field}.baseValue`] = newValue;
      updateData[`system.attributes.${field}.currentValue`] = newValue;
      updateData[`system.attributes.${field}.wounds`] = {
        wound1: false,
        wound2: false,
        wound3: false
      };
    }

    // Perform the update
    await this.actor.update(updateData);
    
    // Ensure the updated currentValue is displayed
    html.find(viewSelector).text(newValue).show();  // Display the updated value
    html.find(editSelector).hide();  // Hide the input field after editing
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

  rollTemperOrAttribute(field, type) {
    let value;
  
    // Get the current value from the temper or attribute
    if (type === 'tempers') {
      value = this.actor.system.tempers[field].currentValue;
    } else if (type === 'attributes') {
      value = this.actor.system.attributes[field].currentValue;
    }
  
    // Ensure value is passed correctly to rollDie
    console.log("Rolling die for:", type, field, "with value:", value); // Debugging check
    rollDie(value);  // Call rollDie with the current value
  }
  
  
}

let rollDie = async (type) => {

  type = type.toLowerCase();

  // Roll a single d12 asynchronously
  let roll = new Roll("1d12");
  await roll.evaluate();

  let dieValue = roll.total;
  let result;

  // Capitalize the first letter of the die type
  let capitalizedType = toUpperCaseValue(type);

  // Determine the result based on the die type
  switch (type) {
    case "malus":
      result = dieValue <= 7 ? "Setback" : dieValue <= 11 ? "Stalemate" : "Gain";
      break;
    case "neutral":
      result = dieValue <= 3 ? "Setback" : dieValue <= 9 ? "Stalemate" : "Gain";
      break;
    case "bonus":
      result = dieValue <= 2 ? "Setback" : dieValue <= 7 ? "Stalemate" : "Gain";
      break;
    case "critical":
      result = dieValue === 1 ? "Setback" : dieValue <= 5 ? "Stalemate" : "Gain";
      break;
    default:
      console.error("Unknown dice type");
      return;
  }

  // Pass the capitalized die type and the result to the chat display function
  displayRollResultsInChat(capitalizedType, result);
};

  function displayRollResultsInChat(capitalizedType, result) {
    // Create the chat message in the desired format
    ChatMessage.create({
      content: `${capitalizedType} rolled: ${result}`,  // Example: "Malus rolled: Setback"
      speaker: ChatMessage.getSpeaker(),
    });
  }

