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
    context.system = actorData.system; // Contient les données de l'acteur
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Gérer la soumission du formulaire
    html.find('#actor-sheet-form').on('submit', async (event) => {
      event.preventDefault();
      await this.updateActorData(html);
    });

    // Gérer les pertes de focus sur le nom
    html.find('#name').on('blur', async (event) => {
      await this.updateActorData(html);
    });

    // Gérer le changement d'élément
    html.find('#element').on('change', async (event) => {
      await this.updateActorData(html);
    });
  }

  async updateActorData(html) {
    const name = html.find('#name').val();
    const element = html.find('#element').val();

    await this.actor.update({
      "system.name.value": name,
      "system.element.value": element,
    });

    ui.notifications.info("Changes saved!");
  }
}
