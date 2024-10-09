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

Hooks.on('getSceneControlButtons', (controls) => {
  console.log("Weave of Echoes | getSceneControlButtons hook triggered");
  if (game.user.isGM) {
    let tokenControls = controls.find(c => c.name === "token");
    if (tokenControls) {
      console.log("Weave of Echoes | Adding Synergy Tracker buttons to the toolbar");

      // Supprimer tous les boutons de synergy tracker existants
      tokenControls.tools = tokenControls.tools.filter(tool => !tool.name.startsWith("synergy-tracker"));

      // Ajouter les boutons pour chaque tracker pré-créé avec des numéros distincts
      if (game.weaveOfEchoes && game.weaveOfEchoes.additionalTrackers) {
        Object.entries(game.weaveOfEchoes.additionalTrackers).forEach(([trackerId, tracker], index) => {
          tokenControls.tools.push({
            name: trackerId,
            title: `Synergy Tracker ${index + 1}`, // Affiche "Synergy Tracker 1", "Synergy Tracker 2", etc.
            icon: "fas fa-circle", // Utilisez une icône appropriée
            button: true,
            onClick: () => tracker.render(true)
          });
          console.log(`Button added for Synergy Tracker ${index + 1}`); // Log pour confirmer l'ajout du bouton
        });
      }

      // Utilisez render() uniquement, sans réinitialiser les contrôles pour éviter la boucle infinie
      console.log("Rendering the SceneControls UI");
      ui.controls.render(); // Rafraîchit l'interface utilisateur des contrôles de manière sûre
    }
  }
});


function generateRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function createNewSynergyTracker() {
  const maxTrackers = 4;
  const currentTrackers = Object.keys(game.weaveOfEchoes.additionalTrackers || {}).length + 1;

  if (currentTrackers >= maxTrackers) {
    ui.notifications.warn(`Maximum trackers created (${maxTrackers}).`);
    return;
  }

  const trackerId = `synergy-tracker-${Date.now()}`;
  const trackerColor = generateRandomColor(); // Générer une couleur unique pour le tracker

  // Créez une nouvelle instance indépendante de SynergyTracker avec des données vierges
  const newTracker = new SynergyTracker({
    appId: trackerId,
    data: {
      currentSynergy: 0,
      maxSynergy: 0,
      characters: [],
      color: trackerColor // Ajouter une couleur unique
    }
  });

  game.weaveOfEchoes.additionalTrackers[trackerId] = newTracker;

  // Sauvegarder le nouveau tracker et ses données
  const savedTrackers = game.settings.get("weave_of_echoes", "savedTrackers") || {};
  savedTrackers[trackerId] = {
    currentSynergy: 0,
    maxSynergy: 0,
    characters: [],
    color: trackerColor
  };
  game.settings.set("weave_of_echoes", "savedTrackers", savedTrackers);

  // Mettre à jour les boutons
  updateSynergyTrackerButtons();

  newTracker.render(true);
}




Hooks.on('ready', async function() {
  if (game.user.isGM) {
    console.log("Weave of Echoes | Initializing Synergy Trackers");

    game.weaveOfEchoes = game.weaveOfEchoes || {};
    game.weaveOfEchoes.additionalTrackers = game.weaveOfEchoes.additionalTrackers || {};

    const maxTrackers = 4;

    for (let i = 1; i <= maxTrackers; i++) {
      const trackerId = `synergy-tracker-${i}`;
      const trackerColor = generateRandomColor();

      const newTracker = new SynergyTracker({
        appId: trackerId,
        data: {
          currentSynergy: 0,
          maxSynergy: 0,
          characters: [],
          color: trackerColor
        }
      });

      game.weaveOfEchoes.additionalTrackers[trackerId] = newTracker;
      console.log(`Tracker created: ${trackerId} with color ${trackerColor}`, newTracker);
    }

    console.log("Final list of all initialized trackers:", game.weaveOfEchoes.additionalTrackers);
    
    // Appeler la fonction pour mettre à jour les boutons
    updateSynergyTrackerButtons();
  }
});

// Fonction pour mettre à jour les boutons de trackers dans la barre de contrôle
function updateSynergyTrackerButtons() {
  const controls = ui.controls.controls;
  const tokenControls = controls.find(c => c.name === "token");

  if (tokenControls) {
    console.log("Weave of Echoes | Adding Synergy Tracker buttons to the toolbar");

    // Supprimer les anciens boutons de synergy tracker
    tokenControls.tools = tokenControls.tools.filter(tool => !tool.name.startsWith("synergy-tracker"));

    // Ajouter les nouveaux boutons pour chaque tracker
    Object.entries(game.weaveOfEchoes.additionalTrackers).forEach(([trackerId, tracker], index) => {
      tokenControls.tools.push({
        name: trackerId,
        title: `Synergy Tracker ${index + 1}`,
        icon: "fas fa-sync-alt",
        button: true,
        onClick: () => tracker.render(true)
      });
      console.log(`Button added for Synergy Tracker ${index + 1}`);
    });

    // Rafraîchir l'interface utilisateur après l'ajout des boutons
    ui.controls.render(); // On force un rafraîchissement des contrôles sans réinitialiser l'état
  }
}


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