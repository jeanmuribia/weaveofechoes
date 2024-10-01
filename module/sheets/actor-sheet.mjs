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
    console.log("Actor Data:", actorData); // Vérifie les données dans la console
    context.system = actorData.system;
    context.actorName = this.actor.name; // Assigne le nom de l'acteur au contexte
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Quand on clique sur "Edit"
    html.find('#edit-button').on('click', (event) => {
        console.log("Edit button clicked");

        // Masque les champs de lecture et affiche les champs d'édition
        html.find('#actor-name').hide();
        html.find('#name-edit').val(this.actor.name).show();
        html.find('#edit-button').hide();
        html.find('#save-button').show();

        // Masque les champs de lecture et affiche les sélecteurs
        html.find('span[id$="-view"]').hide();
        html.find('select[id$="-edit"]').show();
    });

    // Quand on clique sur "Save"
    html.find('#save-button').on('click', async (event) => {
        event.preventDefault(); // Empêche la soumission par défaut

        console.log("Save button clicked");

        // Récupère les nouvelles valeurs des champs
        const newName = html.find('#name-edit').val();
        const element = html.find('#element-edit').val();
        const fire = html.find('#fire-edit').val();
        const water = html.find('#water-edit').val();
        const earth = html.find('#earth-edit').val();
        const air = html.find('#air-edit').val();
        const body = html.find('#body-edit').val();
        const soul = html.find('#soul-edit').val();
        const spirit = html.find('#spirit-edit').val();
        const martial = html.find('#martial-edit').val();
        const elemental = html.find('#elemental-edit').val();
        const rhetoric = html.find('#rhetoric-edit').val();

        // Vérifie si le nom est vide
        if (!newName.trim()) {
            ui.notifications.error("Name cannot be empty.");
            return;
        }

        // Met à jour l'acteur avec les nouvelles données
        await this.actor.update({
            "name": newName,
            "system.element.value": element,
            "system.tempers.fire.value": fire,
            "system.tempers.water.value": water,
            "system.tempers.earth.value": earth,
            "system.tempers.air.value": air,
            "system.attributes.body.value": body,
            "system.attributes.soul.value": soul,
            "system.attributes.spirit.value": spirit,
            "system.attributes.martial.value": martial,
            "system.attributes.elemental.value": elemental,
            "system.attributes.rhetoric.value": rhetoric
        });

        // Rafraîchit l'affichage du nom
        html.find('#actor-name').text(newName).show();
        html.find('#name-edit').hide();

        // Masque les sélecteurs et affiche les champs de lecture
        html.find('select[id$="-edit"]').hide();
        html.find('span[id$="-view"]').show();

        // Masque le bouton Save et réaffiche le bouton Edit
        html.find('#save-button').hide();
        html.find('#edit-button').show();
    });
  }
}
