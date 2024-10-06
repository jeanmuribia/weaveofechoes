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
        actorData.system.tempers[temper].currentValue = 'neutral';  // Set default to 'neutral'
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
      handleSingleDiceRoll("malus");  
    });
    
    html.find('#neutralDie').on('click', () => {
      handleSingleDiceRoll("neutral");  
    });
    
    html.find('#bonusDie').on('click', () => {
      handleSingleDiceRoll("bonus"); 
    });
    
    html.find('#criticalDie').on('click', () => {
      handleSingleDiceRoll("critical");  
    });

     
    // Add click listeners for temper and attribute rollDie based on currentValue
    html.find('#fire-view').on('click', () => handleSingleDiceRoll(this.actor.system.tempers['fire'].currentValue));
    html.find('#water-view').on('click', () => handleSingleDiceRoll(this.actor.system.tempers['water'].currentValue));
    html.find('#earth-view').on('click', () => handleSingleDiceRoll(this.actor.system.tempers['earth'].currentValue));
    html.find('#air-view').on('click', () => handleSingleDiceRoll(this.actor.system.tempers['air'].currentValue));

    html.find('#body-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['body'].currentValue));
    html.find('#mind-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['mind'].currentValue));
    html.find('#soul-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['soul'].currentValue));
    html.find('#martial-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['martial'].currentValue));
    html.find('#elementary-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['elementary'].currentValue));
    html.find('#rhetoric-view').on('click', () => handleSingleDiceRoll(this.actor.system.attributes['rhetoric'].currentValue));


       // Ensure `this.actor` is correctly passed to the maneuver window
  html.find('#maneuver-button').on('click', (event) => {
    openManeuverWindow(this.actor);  // Pass the actor correctly
  });

  // Attribute selection listener (only one can be selected within the attribute question)
$(document).on('click', '.attribute-choice', function() {
  selectedAttribute = $(this).data('attribute');
  // Remove the 'selected' class only from the attribute choices
  $('.attribute-choice').removeClass('selected');
  // Add 'selected' class to the clicked attribute button
  $(this).addClass('selected');
});

// Temper selection listener (only one can be selected within the temper question)
$(document).on('click', '.temper-choice', function() {
  if (!$(this).hasClass('disabled')) {
    selectedTemper = $(this).data('temper');
    // Remove 'selected' class only from the temper choices
    $('.temper-choice').removeClass('selected');
    // Add 'selected' class to the clicked temper button
    $(this).addClass('selected');
  }
});

// Context selection listener (only one can be selected within the context question)
$(document).on('click', '.context-choice', function() {
  selectedContext = $(this).data('context');
  // Remove 'selected' class only from the context choices
  $('.context-choice').removeClass('selected');
  // Add 'selected' class to the clicked context button
  $(this).addClass('selected');
});
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

async function rollDie(type) {
  if (!type) {
    console.error("rollDie received an invalid type:", type);
    return "undefined";  // Return a string instead of undefined if type is invalid
  }

  // Log the type being rolled
  console.log("Rolling dice for type:", type);

  // Convert the type to lowercase
  type = type.toLowerCase();

  // Roll a d12
  let roll = new Roll("1d12");
  await roll.evaluate();

  console.log("Roll Result:", roll.total);

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
      console.error("Unknown dice type:", type);
      result = "undefined";
  }

  // Log the final result
  console.log("Result for type", type, ":", result);

  return result;
}

async function handleSingleDiceRoll(type) {
  const capitalizedType = toUpperCaseValue(type);
  const result = await rollDie(type);
  displayRollResultsInChat(capitalizedType, result);
}

  function displayRollResultsInChat(capitalizedType, result) {
    // Create the chat message in the desired format
    ChatMessage.create({
      content: `${capitalizedType} rolled: ${result}`,  // Example: "Malus rolled: Setback"
      speaker: ChatMessage.getSpeaker(),
    });
  }

  // Function to open the maneuver window
function openManeuverWindow(actor) {
  let content = `
    <div>
      <h3>On which of your attributes are you relying on?</h3>
      <div id="attribute-section">
        ${createAttributeSelection(actor)}
      </div>

      <h3>What is your current state of mind?</h3>
      <div id="temper-section">
        ${createTemperSelection(actor)}
      </div>

      <h3>How advantageous to you is the context?</h3>
      <div id="context-section">
        ${createContextSelection()}
      </div>
    </div>
  `;

  // Render the window using Foundry's Dialog
  new Dialog({
    title: "Maneuver",
    content: content,
    buttons: {
      maneuver: {
        label: "Launch Maneuver",
        callback: async () => {
          // Handle the dice rolling when the button is clicked
          await launchManeuver(actor);
        }
      }
    }
  }).render(true);
}

// Helper function to create the attribute selection
function createAttributeSelection(actor) {
  return `
    <button class="attribute-choice" data-attribute="body">Body</button>
    <button class="attribute-choice" data-attribute="soul">Soul</button>
    <button class="attribute-choice" data-attribute="mind">Mind</button>
    <button class="attribute-choice" data-attribute="martial">Martial</button>
    <button class="attribute-choice" data-attribute="elemental">Elemental</button>
    <button class="attribute-choice" data-attribute="rhetoric">Rhetoric</button>
  `;
}

// Helper function to create the temper selection
function createTemperSelection(actor) {
  const tempers = ['fire', 'water', 'earth', 'air'];
  return tempers.map(temper => {
    let trauma = actor.system.tempers[temper].wound;  // Check for trauma
    let disabled = trauma ? 'disabled' : '';
    let classDisabled = trauma ? 'class="disabled"' : '';
    return `<button class="temper-choice" data-temper="${temper}" ${disabled} ${classDisabled}>${toUpperCaseValue(temper)}</button>`;
  }).join('');
}

// Helper function to create the context selection
function createContextSelection() {
  return `
    <button class="context-choice" data-context="malus">Detrimental</button>
    <button class="context-choice" data-context="neutral">Neutral</button>
    <button class="context-choice" data-context="bonus">Favorable</button>
    <button class="context-choice" data-context="critical">Highly Beneficial</button>
  `;
}

// Variables to store selected options
let selectedAttribute = null;
let selectedTemper = null;
let selectedContext = null;

// Event listeners for attribute, temper, and context choices
$(document).on('click', '.attribute-choice', function() {
  selectedAttribute = $(this).data('attribute');
  $('.attribute-choice').removeClass('selected');
  $(this).addClass('selected');
});

$(document).on('click', '.temper-choice', function() {
  if (!$(this).hasClass('disabled')) {
    selectedTemper = $(this).data('temper');
    $('.temper-choice').removeClass('selected');
    $(this).addClass('selected');
  }
});

$(document).on('click', '.context-choice', function() {
  selectedContext = $(this).data('context');
  $('.context-choice').removeClass('selected');
  $(this).addClass('selected');
});


//Launch maneuver function//
async function launchManeuver(actor) {
  if (!selectedAttribute || !selectedTemper || !selectedContext) {
    ui.notifications.error("You must answer all three questions.");
    return;
  }

  // Retrieve the current values for the selected attribute and temper
  const attributeValue = actor.system.attributes[selectedAttribute]?.currentValue;
  const temperValue = actor.system.tempers[selectedTemper]?.currentValue;

  // Ensure values exist before proceeding with the roll
  if (!attributeValue || !temperValue) {
    console.error("Invalid selections:", selectedAttribute, selectedTemper, selectedContext);
    return;
  }

  // Roll the dice for the attribute, temper, and context
  const attributeResult = await rollDie(attributeValue);
  const temperResult = await rollDie(temperValue);
  const contextResult = await rollDie(selectedContext);

  // Format the message according to your requirement: "AttributeLabel, TemperLabel, and Context ANSWER"
  const message = `${toUpperCaseValue(selectedAttribute)}, ${toUpperCaseValue(selectedTemper)} & ${toUpperCaseValue(selectedContext)} rolled: ${attributeResult}, ${temperResult}, ${contextResult}`;

  // Display the results in the chat
  ChatMessage.create({
    content: message,
    speaker: ChatMessage.getSpeaker(),
  });
}