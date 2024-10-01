import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

/**
 * Extend the basic ActorSheet with some simple modifications
 * @extends {ActorSheet}
 */
export class WoeActorSheet extends ActorSheet {
  /** @override */
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

  /** @override */
  get template() {
    return `systems/weave_of_echoes/templates/actor/actor-character-sheet.hbs`;
  }

  /** @override */
  async getData() {
    const context = super.getData();
    const actorData = this.document.toObject(false);
    context.system = actorData.system;
    context.actorName = this.actor.name;
    return context;
  }

/** @override */
activateListeners(html) {
  super.activateListeners(html);

  // Activer l'édition au clic pour le nom
html.find('#actor-name').on('click', (event) => {
  html.find('#actor-name').hide();
  html.find('#name-edit').prop('disabled', false).show().focus(); // Afficher le champ d'édition du nom
});

// Sauvegarder lors de la perte de focus sur le nom
html.find('#name-edit').on('blur', async (event) => {
  const newName = html.find('#name-edit').val();

  if (newName.trim()) { // Vérifie si le nom n'est pas vide
    // Mise à jour de la valeur dans l'acteur
    await this.actor.update({
      "name": newName // Mise à jour du nom
    });

    // Afficher la nouvelle valeur et cacher l'édition
    html.find('#actor-name').text(newName).show();
  } else {
    // Si le nom est vide, réaffiche l'ancien nom
    html.find('#actor-name').show();
  }
  html.find('#name-edit').hide();
});

  // Activer l'édition pour la Stamina Max
  html.find('#stamina-max-view').on('click', (event) => {
    html.find('#stamina-max-view').hide();
    html.find('#stamina-max-edit').show().focus(); // Affiche la liste de sélection pour la Stamina Max
  });

  // Sauvegarder la Stamina Max lors de la perte de focus
  html.find('#stamina-max-edit').on('change', async (event) => {
    const newStaminaMax = html.find('#stamina-max-edit').val();

    // Mettre à jour la Stamina Max et Current Stamina
    await this.actor.update({
      "system.stamina.max": newStaminaMax,
      "system.stamina.current": newStaminaMax // Mettez à jour la Current Stamina avec la Max
    });

    // Afficher les nouvelles valeurs et cacher l'édition
    html.find('#stamina-max-view').text(newStaminaMax).show();
    html.find('#current-stamina-view').text(newStaminaMax).show();
    html.find('#stamina-max-edit').hide();
  });

  // Gestion des boutons "+" et "-" pour Current Stamina
  html.find('#stamina-decrease').on('click', async (event) => {
    let currentStamina = parseInt(html.find('#current-stamina-view').text());
    const maxStamina = parseInt(html.find('#stamina-max-view').text());

    if (currentStamina > 0) {
      currentStamina--;
      await this.actor.update({
        "system.stamina.current": currentStamina
      });
      html.find('#current-stamina-view').text(currentStamina);
    }
  });

  html.find('#stamina-increase').on('click', async (event) => {
    let currentStamina = parseInt(html.find('#current-stamina-view').text());
    const maxStamina = parseInt(html.find('#stamina-max-view').text());

    if (currentStamina < maxStamina) {
      currentStamina++;
      await this.actor.update({
        "system.stamina.current": currentStamina
      });
      html.find('#current-stamina-view').text(currentStamina);
    }
  });

  // Activer l'édition pour les tempers et attributs
  this.enableEditOnClick(html, 'element'); // Activer la modification de l'élément
  this.enableEditOnClick(html, 'fire');
  this.enableEditOnClick(html, 'water');
  this.enableEditOnClick(html, 'earth');
  this.enableEditOnClick(html, 'air');
  this.enableEditOnClick(html, 'body');
  this.enableEditOnClick(html, 'soul');
  this.enableEditOnClick(html, 'spirit');
  this.enableEditOnClick(html, 'martial');
  this.enableEditOnClick(html, 'elemental');
  this.enableEditOnClick(html, 'rhetoric');
}

// Fonction pour activer l'édition d'un champ au clic
enableEditOnClick(html, field) {
  const viewSelector = `#${field}-view`;
  const editSelector = `#${field}-edit`;

  // Quand on clique sur le champ en mode lecture
  html.find(viewSelector).on('click', (event) => {
    html.find(viewSelector).hide();
    html.find(editSelector).prop('disabled', false).show().focus();
  });

  // Sauvegarder lors de la perte de focus
  html.find(editSelector).on('blur', async (event) => {
    const newValue = html.find(editSelector).val();

    // Mise à jour de la valeur dans l'acteur
    let updateData = {};
    if (field === 'element') {
      updateData[`system.element.value`] = newValue;
    } else if (['fire', 'water', 'earth', 'air'].includes(field)) {
      updateData[`system.tempers.${field}.value`] = newValue;
    } else {
      updateData[`system.attributes.${field}.value`] = newValue;
    }
    await this.actor.update(updateData);

    // Afficher la nouvelle valeur et cacher l'édition
    html.find(viewSelector).text(newValue).show();
    html.find(editSelector).hide();
  });
}
}