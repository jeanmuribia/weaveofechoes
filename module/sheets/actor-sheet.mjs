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
        // Masque le nom statique et affiche le champ d'édition
        html.find('#actor-name').hide();
        html.find('#name-edit').val(this.actor.name).show(); // Préremplit et affiche le champ de texte avec le nom actuel
        html.find('#edit-button').hide(); // Masque le bouton Edit
        html.find('#save-button').show(); // Affiche le bouton Save

        // Active tous les champs pour qu'ils soient modifiables
        html.find('input, select').prop('disabled', false); // Active tous les champs et listes déroulantes
    });

    // Quand on clique sur "Save"
    html.find('#save-button').on('click', async (event) => {
      // Récupère la nouvelle valeur du nom et des autres champs
      const newName = html.find('#name-edit').val(); // Champ du nom
      const element = html.find('#element').val();  // Liste déroulante pour l'élément
  
      // Récupérer les valeurs des tempers
      const fire = html.find('#fire').val();
      const water = html.find('#water').val();
      const earth = html.find('#earth').val();
      const air = html.find('#air').val();

      // Récupérer les valeurs des attributes
      const corp = html.find('#corp').val();
      const soul = html.find('#soul').val();
      const spirit = html.find('#spirit').val();
      const martial = html.find('#martial').val();
      const elemental = html.find('#elemental').val();
      const rhetoric = html.find('#rhetoric').val();

      // Vérifie si le nom est vide
      if (!newName.trim()) {
          ui.notifications.error("Name cannot be empty.");
          return;
      }
  
      // Met à jour l'acteur avec les nouvelles données
      await this.actor.update({
          "name": newName, // Met à jour le nom
          "system.element.value": element, // Met à jour l'élément
          "system.tempers.fire.value": fire, // Met à jour les tempers
          "system.tempers.water.value": water,
          "system.tempers.earth.value": earth,
          "system.tempers.air.value": air,
          "system.attributes.corp.value": corp, // Met à jour les attributs
          "system.attributes.soul.value": soul,
          "system.attributes.spirit.value": spirit,
          "system.attributes.martial.value": martial,
          "system.attributes.elemental.value": elemental,
          "system.attributes.rhetoric.value": rhetoric
      });
  
      // Rafraîchit l'affichage du nom
      html.find('#actor-name').text(newName).show(); // Affiche le nouveau nom
      html.find('#name-edit').hide(); // Masque le champ d'édition
  
      // Désactive les champs après sauvegarde (lecture seule)
      html.find('input, select').prop('disabled', true); 
  
      // Masque le bouton Save et réaffiche le bouton Edit
      html.find('#save-button').hide(); 
      html.find('#edit-button').show(); 
  });
  }
}
