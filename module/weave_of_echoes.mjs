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
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.on('getSceneControlButtons', (controls) => {
  if (game.user.isGM) {
    console.log("Adding Synergy Tracker button to controls");
    
    // Trouver le groupe de contrôles "token"
    let tokenControls = controls.find(c => c.name === "token");
    
    if (tokenControls) {
      // Ajouter notre bouton au groupe "token"
      tokenControls.tools.push({
        name: "synergy-tracker",
        title: "Synergy Tracker",
        icon: "fas fa-sync-alt",
        button: true,
        onClick: () => {
          console.log("Synergy Tracker button clicked");
          if (game.weaveOfEchoes && game.weaveOfEchoes.synergyTracker) {
            if (game.weaveOfEchoes.synergyTracker.rendered) {
              game.weaveOfEchoes.synergyTracker.close();
            } else {
              game.weaveOfEchoes.synergyTracker.render(true);
            }
          } else {
            ui.notifications.error("Synergy Tracker not initialized");
          }
        }
      });
    }
  }
});

Hooks.on('ready', async function() {
  if (game.user.isGM) {
    console.log("Initializing Weave of Echoes and Synergy Tracker");

    // Initialize the weaveOfEchoes namespace
    game.weaveOfEchoes = game.weaveOfEchoes || {};

    try {
      // Initialize the synergyTracker
      game.weaveOfEchoes.synergyTracker = new SynergyTracker();
      console.log("SynergyTracker initialized:", game.weaveOfEchoes.synergyTracker);

      // Load saved synergy data
      let savedSynergyData = game.settings.get("weave_of_echoes", "synergyData");
      console.log("Loaded saved synergy data:", savedSynergyData);

      if (savedSynergyData) {
        game.weaveOfEchoes.synergyTracker.currentSynergy = savedSynergyData.currentSynergy;
        game.weaveOfEchoes.synergyTracker.maxSynergy = savedSynergyData.maxSynergy;
        
        // Map character IDs to actual Actor objects, filtering out any that don't exist
        game.weaveOfEchoes.synergyTracker.groupMembers = savedSynergyData.characters
          .map(charId => game.actors.get(charId))
          .filter(char => char);

        console.log("Updated SynergyTracker with saved data:", {
          currentSynergy: game.weaveOfEchoes.synergyTracker.currentSynergy,
          maxSynergy: game.weaveOfEchoes.synergyTracker.maxSynergy,
          groupMembers: game.weaveOfEchoes.synergyTracker.groupMembers
        });
      } else {
        console.log("No saved synergy data found");
      }
    } catch (error) {
      console.error("Error initializing Synergy Tracker:", error);
    }
  } else {
    console.log("User is not GM, skipping Synergy Tracker initialization");
  }
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
