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
    context.system = actorData.system; // Contains actor data
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Handle losing focus on the name
    html.find('#name').on('blur', async (event) => {
      await this.updateActorData(html);
    });

    // Handle changing element
    html.find('#element').on('change', async (event) => {
      await this.updateActorData(html);
    });

    // Handle changing tempers
    html.find('select[name^="temper-"]').on('change', async (event) => {
      await this.updateActorData(html);
    });

    // Handle changing attributes
    html.find('select[name^="attributes-"]').on('change', async (event) => {
      await this.updateActorData(html);
    });
  }

  // Function to update actor data
  async updateActorData(html) {
    const name = html.find('#name').val();
    const element = html.find('#element').val();

    // Prepare the update object for tempers
    const tempers = {
      fire: { value: html.find('select[name="temper-fire"]').val() },
      water: { value: html.find('select[name="temper-water"]').val() },
      earth: { value: html.find('select[name="temper-earth"]').val() },
      air: { value: html.find('select[name="temper-air"]').val() }
    };

    // Prepare the update object for attributes
    const attributes = {
      body: { value: html.find('select[name="attributes-body"]').val() },
      soul: { value: html.find('select[name="attributes-soul"]').val() },
      spirit: { value: html.find('select[name="attributes-spirit"]').val() },
      martial: { value: html.find('select[name="attributes-martial"]').val() },
      elemental: { value: html.find('select[name="attributes-elemental"]').val() },
      rhetoric: { value: html.find('select[name="attributes-rhetoric"]').val() }
    };

    // Update the actor with the new data
    await this.actor.update({
      "system.name.value": name,
      "system.element.value": element,
      "system.tempers": tempers,
      "system.attributes": attributes
    });
  }
}