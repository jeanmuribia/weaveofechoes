import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

/**
 * Extend the basic ActorSheet with some simple modifications
 * @extends {ActorSheet}
 */
export class WoeActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['weave_of_echoes', 'sheet', 'actor'],
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
    context.system = actorData.system; // Contient les données de l'acteur
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Gérer les pertes de focus sur le nom
    html.find('#name').on('blur', async (event) => {
      await this.updateActorData(html);
    });

    // Gérer le changement d'élément
    html.find('#element').on('change', async (event) => {
      await this.updateActorData(html);
    });

    // Gérer le changement de tempérament
    html.find('select[name^="temperament-"]').on('change', async (event) => {
      await this.updateActorData(html);
    });
  }

  // Fonction pour mettre à jour les données de l'acteur
  async updateActorData(html) {
    const name = html.find('#name').val();
    const element = html.find('#element').val();

    // Prépare l'objet de mise à jour pour les tempéraments
    const temperaments = {
      fire: { value: html.find('select[name="temperament-fire"]').val() },
      water: { value: html.find('select[name="temperament-water"]').val() },
      earth: { value: html.find('select[name="temperament-earth"]').val() },
      air: { value: html.find('select[name="temperament-air"]').val() }
    };

    // Met à jour l'acteur avec les nouvelles données
    await this.actor.update({
      "system.name.value": name,
      "system.element.value": element,
      "system.temperaments": temperaments
    });

    // Affiche une notification pour indiquer que les changements ont été enregistrés
    ui.notifications.info("Changes saved!");
  }
}
