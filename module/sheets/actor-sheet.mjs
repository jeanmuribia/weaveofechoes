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
          contentSelector: '.sheet-body',
          initial: 'features',
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

    // Initialize Stamina Max to 4 if undefined
    if (!this.actor.system.stamina.max || isNaN(this.actor.system.stamina.max)) {
      this.actor.update({ "system.stamina.max": 4 });
    }

    // Handle name editing
    html.find('#actor-name').on('click', (event) => {
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

    // Handle editing of Stamina Max
    html.find('#stamina-max-view').on('click', (event) => {
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

    // Enable temper and attributes edit
    this.enableEditOnClick(html, 'element');
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
  }

  enableEditOnClick(html, field) {
    const viewSelector = `#${field}-view`;
    const editSelector = `#${field}-edit`;

    html.find(viewSelector).on('click', (event) => {
      html.find(viewSelector).hide();
      html.find(editSelector).prop('disabled', false).show().focus();
    });

    html.find(editSelector).on('blur', async (event) => {
      const newValue = html.find(editSelector).val();
      let updateData = {};
      if (field === 'element') {
        updateData[`system.element.value`] = newValue;
      } else if (['fire', 'water', 'earth', 'air'].includes(field)) {
        updateData[`system.tempers.${field}.value`] = newValue;
      } else {
        updateData[`system.attributes.${field}.baseValue`] = newValue;
        updateData[`system.attributes.${field}.wounds`] = { wound1: false, wound2: false, wound3: false };
      }
      await this.actor.update(updateData);
      this.updateAttributeCurrentValue(field);
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
