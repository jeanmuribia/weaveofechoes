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
      html.find('#name-edit').prop('disabled', false).show().focus(); // Activer et afficher le champ d'édition du nom
    });

    // Sauvegarder lors de la perte de focus sur le nom
    html.find('#name-edit').on('blur', async (event) => {
      const newName = html.find('#name-edit').val();

      // Mise à jour de la valeur dans l'acteur
      await this.actor.update({
        "name": newName // Mise à jour du nom
      });

      // Afficher la nouvelle valeur et cacher l'édition
      html.find('#actor-name').text(newName).show();
      html.find('#name-edit').hide();
    });

    // Activer l'édition au clic pour les éléments
    this.enableEditOnClick(html, 'element');

    // Activer l'édition pour les tempers et attributs
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
