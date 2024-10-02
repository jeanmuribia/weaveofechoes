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

    // Initialiser Stamina Max à 4 si elle est absente ou indéfinie
    if (!this.actor.system.stamina.max || isNaN(this.actor.system.stamina.max)) {
      this.actor.update({ "system.stamina.max": 4 });
    }

    // Gérer l'édition du nom
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

    // Gérer les boutons + et - pour la Current Stamina
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

    // Gérer l'édition de Stamina Max
    html.find('#stamina-max-view').on('click', (event) => {
      html.find('#stamina-max-view').hide();
      html.find('#stamina-max-edit').show().focus(); // Afficher le champ d'édition
    });

    html.find('#stamina-max-edit').on('blur', async (event) => {
      let newStaminaMax = parseInt(html.find('#stamina-max-edit').val());

      // Si la nouvelle Stamina Max est invalide, utiliser une valeur par défaut
      if (!newStaminaMax || isNaN(newStaminaMax)) {
        newStaminaMax = 4; // Par exemple, valeur par défaut 4
      }

      await this.actor.update({
        "system.stamina.max": newStaminaMax,
        "system.stamina.current": Math.min(this.actor.system.stamina.current, newStaminaMax) // Ajuster la current si elle dépasse la max
      });

      html.find('#stamina-max-view').text(newStaminaMax).show(); // Réafficher la Stamina Max mise à jour
      html.find('#current-stamina-view').text(this.actor.system.stamina.current).show(); // Afficher la valeur actuelle ajustée
      html.find('#stamina-max-edit').hide(); // Cacher le champ d'édition après validation
    });

    // Activer l'édition pour les tempers et attributs
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

    // Logique pour gérer les blessures (wounds)
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
      } else if (['fire'].includes(field)) {
        updateData[`system.tempers.${field}.value`] = newValue;
      } else {
        updateData[`system.attributes.${field}.baseValue`] = newValue;
        updateData[`system.attributes.${field}.wounds`] = { wound1: false, wound2: false, wound3: false }; // Réinitialiser les wounds
      }
      await this.actor.update(updateData);
      this.updateAttributeCurrentValue(field); // Recalcule la currentValue après la modification
      html.find(viewSelector).text(newValue).show();
      html.find(editSelector).hide();
    });
  }

  // Gestion des listeners et mise à jour des wounds
  manageWoundsListeners(html, attribute) {
    const attr = this.actor.system.attributes[attribute];

    const wound1 = html.find(`#${attribute}-wound1`);
    const wound2 = html.find(`#${attribute}-wound2`);
    const wound3 = html.find(`#${attribute}-wound3`);

    // Apply wound logic for attribute
    this.manageWoundCheckboxes(attribute, html, wound1, wound2, wound3);

    wound1.on('change', async (event) => {
      const checked = event.target.checked;
      await this.actor.update({
        [`system.attributes.${attribute}.wounds.wound1`]: checked
      });
      this.updateAttributeCurrentValue(attribute, html);
    });

    wound2.on('change', async (event) => {
      const checked = event.target.checked;
      await this.actor.update({
        [`system.attributes.${attribute}.wounds.wound2`]: checked
      });
      this.updateAttributeCurrentValue(attribute, html);
    });

    wound3.on('change', async (event) => {
      const checked = event.target.checked;
      await this.actor.update({
        [`system.attributes.${attribute}.wounds.wound3`]: checked
      });
      this.updateAttributeCurrentValue(attribute, html);
    });
  }

  // Updated to manage specific wounds for each attribute separately
  manageWoundCheckboxes(attribute, html, wound1, wound2, wound3) {
    const attr = this.actor.system.attributes[attribute];
    const wounds = attr.wounds;

    // Check the state of each attribute's wound system and disable or enable accordingly
    if (attr.baseValue === "malus") {
      wound1.prop('disabled', true);
      wound2.prop('disabled', true);
      wound3.prop('disabled', true);
      return;
    }

    if (attr.currentValue === "malus") {
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

  // Call manageWoundCheckboxes separately for each attribute
  async updateAttributeCurrentValue(attribute, html) {
    const attr = this.actor.system.attributes[attribute];
    let currentValue = attr.baseValue;

    if (attr.wounds.wound1) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound2) currentValue = this.degradeAttributeValue(currentValue);
    if (attr.wounds.wound3) currentValue = this.degradeAttributeValue(currentValue);

    await this.actor.update({
      [`system.attributes.${attribute}.currentValue`]: currentValue
    });

    // Manage the wound checkboxes for the specific attribute
    const wound1 = html.find(`#${attribute}-wound1`);
    const wound2 = html.find(`#${attribute}-wound2`);
    const wound3 = html.find(`#${attribute}-wound3`);

    this.manageWoundCheckboxes(attribute, html, wound1, wound2, wound3);
  }

  degradeAttributeValue(value) {
    switch (value) {
      case "critical":
        return "bonus";
      case "bonus":
        return "neutral";
      case "neutral":
        return "malus";
      case "malus":
        return "malus";
      default:
        return value;
    }
  }
}
