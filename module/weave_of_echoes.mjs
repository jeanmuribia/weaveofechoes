// Import document classes.
import { WoeActor } from './documents/actor.mjs';
import { WoeItem } from './documents/item.mjs';
// Import sheet classes.
import { WoeActorSheet } from './sheets/actor-sheet.mjs';
import { WoeItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { WOE } from './helpers/config.mjs';
import { SynergyTracker } from './synergy-tracker.js';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */


Hooks.once('init', function () {
 

  game.weaveOfEchoes = game.weaveOfEchoes || {};
  game.weaveOfEchoes.additionalTrackers = {};

  console.log("Weave of Echoes | Initializing System");

  // Add utility classes to the global game object so that they're more easily accessible in global contexts.
  game.woe = {
    WoeActor,
    WoeItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.WOE = WOE;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.dex.mod',
    decimals: 2,
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = WoeActor;
  CONFIG.Item.documentClass = WoeItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('woe', WoeActorSheet, {
    makeDefault: true,
    label: 'WOE.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('woe', WoeItemSheet, {
    makeDefault: true,
    label: 'WOE.SheetLabels.Item',
  });

  // Preload Handlebars templates.
  preloadHandlebarsTemplates();

  // Register game settings for synergy
  game.settings.register("weave_of_echoes", "synergyData", {
    name: "Synergy Data",
    hint: "Stores synergy related data.",
    scope: "world",
    config: false,
    default: { currentSynergy: 0, maxSynergy: 0, characters: [] },
    type: Object,
  });

  game.settings.register("weave_of_echoes", "groupMembers", {
    name: "Group Members",
    hint: "Stores the current members of the synergy group.",
    scope: "world",
    config: false,
    default: [],
    type: Array,
  });

  game.settings.register("weave_of_echoes", "savedTrackers", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */
Hooks.once('ready', () => {
  if (game.user.isGM) {
    const colors = ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA'];
    // Nous n'ajoutons plus tous les personnages au groupe 1 par défaut
    for (let i = 1; i <= 4; i++) {
      const trackerId = `synergy-tracker-${i}`;
      const charactersInGroup = []; // Initialiser chaque groupe, y compris le groupe 1, comme vide

      game.weaveOfEchoes.additionalTrackers[trackerId] = new SynergyTracker({
        appId: trackerId,
        title: `Synergy Group ${i}`,
        data: {
          currentSynergy: 0,
          maxSynergy: 0,
          characters: charactersInGroup,
          color: colors[i - 1]
        }
      });
    }
  }
});

Hooks.on('getSceneControlButtons', (controls) => {
  if (game.user.isGM) {
    let tokenControls = controls.find(c => c.name === "token");
    if (tokenControls) {
      for (let i = 1; i <= 4; i++) {
        tokenControls.tools.push({
          name: `synergy-tracker-${i}`,
          title: `Synergy Group ${i}`,
          icon: "fas fa-users",
          button: true,
          onClick: () => {
            const tracker = game.weaveOfEchoes.additionalTrackers[`synergy-tracker-${i}`];
            if (tracker) tracker.render(true);
            else ui.notifications.warn(`Synergy Tracker ${i} not initialized`);
          }
        });
      }
    }
  }
});

Hooks.on('updateSynergyTracker', (actor) => {
  for (const trackerId in game.weaveOfEchoes.additionalTrackers) {
    const tracker = game.weaveOfEchoes.additionalTrackers[trackerId];
    tracker.calculateMaxSynergy();
    tracker.render(false); // Mise à jour visuelle du tracker
  }
});

// Ensure this code runs after the tracker is rendered
Hooks.on('renderSynergyTracker', (app, html) => {
  html.find('.member-item').click(function () {
    console.log("Click event triggered for:", this.textContent); // Log when the click event is triggered
    selectMember(this);
  });
});

Handlebars.registerHelper('includes', function(array, value, options) {
  if (array && array.includes(value)) {
      return options.fn(this);
  }
  return options.inverse(this);
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.woe.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'woe.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

// Ajout d'un bouton personnalisé dans la barre latérale de Foundry VTT pour ouvrir les trackers
Hooks.on('renderJournalDirectory', (app, html) => {
  const header = html.find(".directory-header");

  // Créez un conteneur pour les boutons de Synergy Trackers
  const trackerContainer = $(`
    <div class="header-actions action-buttons flexrow">
      <h3>Synergy Trackers</h3>
      <button class="tracker-button" data-tracker="1">Tracker 1</button>
      <button class="tracker-button" data-tracker="2">Tracker 2</button>
      <button class="tracker-button" data-tracker="3">Tracker 3</button>
      <button class="tracker-button" data-tracker="4">Tracker 4</button>
    </div>
  `);

  // Ajoutez les boutons de tracker à l'interface de la barre latérale
  header.after(trackerContainer);

  // Ajoutez un gestionnaire d'événements pour ouvrir le tracker correspondant lorsqu'un bouton est cliqué
  trackerContainer.find(".tracker-button").click(ev => {
    const trackerNumber = $(ev.currentTarget).data("tracker");
    const trackerId = `synergy-tracker-${trackerNumber}`;
    const tracker = game.weaveOfEchoes.additionalTrackers[trackerId];
    if (tracker) {
      tracker.render(true);
    } else {
      ui.notifications.warn(`Tracker ${trackerNumber} n'est pas disponible.`);
    }
  });
});