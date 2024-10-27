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
import { FocusTracker } from './focus-tracker.mjs';
import { InitiativeTracker } from './initiative/initiative-tracker.mjs';
import { InitiativeDisplay } from './initiative/initiative-display.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */


Hooks.once('init', function () {
 

  game.weaveOfEchoes = game.weaveOfEchoes || {};
  game.weaveOfEchoes.additionalTrackers = {};
  game.weaveOfEchoes.initiativeTracker = null;

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
    
    // Initialisation des Synergy Trackers
    for (let i = 1; i <= 4; i++) {
      const trackerId = `synergy-tracker-${i}`;
      const charactersInGroup = [];

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

      // Rendre automatiquement SynergyTracker 1 au démarrage
      if (i === 1) {
        game.weaveOfEchoes.additionalTrackers[trackerId].render(true);
      }
    }

    // Initialisation du Focus Tracker
    game.weaveOfEchoes.focusTracker = new FocusTracker({
      data: {
        members: []
      }
    });
    game.weaveOfEchoes.focusTracker.render(true);

    if (game.user.isGM) {
      game.weaveOfEchoes.initiativeTracker = new InitiativeTracker();
  }
  game.weaveOfEchoes.initiativeDisplay = new InitiativeDisplay();
  game.weaveOfEchoes.initiativeDisplay.render(true);
  if (game.weaveOfEchoes.initiativeTracker?.isInitiativeDrawn) {
    Hooks.callAll('updateInitiativeTracker', {
        drawnInitiative: game.weaveOfEchoes.initiativeTracker.drawnInitiative,
        isInitiativeDrawn: game.weaveOfEchoes.initiativeTracker.isInitiativeDrawn
    });
}
  }

    
});

Hooks.on('getSceneControlButtons', (controls) => {
  if (game.user.isGM) {
    let tokenControls = controls.find(c => c.name === "token");
    
    
    if (tokenControls) {
      // Ajoute le bouton pour le Synergy Tracker 1
      tokenControls.tools.push({
        name: "synergy-tracker-1",
        title: "Synergy Tracker 1",
        icon: "fas fa-users",  // Icône FontAwesome
        button: true,
        onClick: () => {
          const tracker1 = game.weaveOfEchoes.additionalTrackers['synergy-tracker-1'];
          if (tracker1) {
            tracker1.render(true);
          } else {
            ui.notifications.warn(`Synergy Tracker 1 n'est pas disponible.`);
          }
        }
      });

      // Ajoute le bouton pour le Focus Tracker
      tokenControls.tools.push({
        name: "focus-tracker",
        title: "Focus Tracker",
        icon: "fas fa-bullseye",  // Icône FontAwesome
        button: true,
        onClick: () => {
          if (!game.weaveOfEchoes.focusTracker) {
            game.weaveOfEchoes.focusTracker = new FocusTracker();
          }
          game.weaveOfEchoes.focusTracker.render(true);
        }
      });
      
      //ajoute le boutk
      tokenControls.tools.push({
        name: "initiative-tracker",
        title: "Initiative Tracker",
        icon: "fas fa-list-ol",
        button: true,
        onClick: () => {
          game.weaveOfEchoes.initiativeTracker.render(true);
        }
      });
    }
  }
});

// Mettre à jour le Focus Tracker quand les relations changent
Hooks.on('updateActor', (actor, changes, options, userId) => {
  if (changes.system?.relationships && game.user.isGM) {
    game.weaveOfEchoes.focusTracker.render();
  }
});

Hooks.on('updateActor', (actor, changes, options, userId) => {
  if (changes.system?.relationships && game.user.isGM) {
      // Recalculer les Focus Points pour cet acteur
      actor.calculateBaseFocusPoints(game.weaveOfEchoes.focusTracker.selectedGroupMembers);

      // Rendre le Focus Tracker pour refléter les nouvelles valeurs
      game.weaveOfEchoes.focusTracker.render();
  }
});

Hooks.on('updateSynergyTracker', (actor) => {
  for (const trackerId in game.weaveOfEchoes.additionalTrackers) {
    const tracker = game.weaveOfEchoes.additionalTrackers[trackerId];
    tracker.calculateMaxSynergy();
    tracker.render(false); // Mise à jour visuelle du tracker
  }
});

Hooks.on('updateInitiativeTracker', (tracker) => {
  console.log("updateInitiativeTracker hook triggered with:", tracker);

  if (game.weaveOfEchoes.initiativeDisplay) {
      game.weaveOfEchoes.initiativeDisplay.updateDisplay(tracker.drawnInitiative);
  }
});

function selectMember(element) {
  console.log("Before adding class:", element.classList); // Afficher les classes avant l'ajout

  // Supprimer la classe 'selected' des autres membres
  document.querySelectorAll('.member-item.selected').forEach(item => {
      item.classList.remove('selected');
      console.log("Removed selected class from:", item.textContent);
  });

  // Ajouter la classe 'selected' à l'élément cliqué
  element.classList.add('selected');
  console.log("After adding class:", element.classList); // Afficher les classes après l'ajout
}
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

  // Créer le bouton
  const initiativeButton = $(`
    <div class="action-buttons flexrow">
      <button type="button" class="initiative-display-button">
        <i class="fas fa-eye"></i> Initiative Display
      </button>
    </div>
  `);
  
  // Ajouter le bouton en haut du panneau Journal
  const journalHeader = html.find('.directory-header');
  journalHeader.after(initiativeButton);
  
  // Ajouter l'événement de clic
  initiativeButton.find('.initiative-display-button').click(() => {
    if (game.weaveOfEchoes.initiativeDisplay) {
      game.weaveOfEchoes.initiativeDisplay.render(true);
    }
  });

  // Ajouter du style pour le bouton
  initiativeButton.find('.initiative-display-button').css({
    width: '100%',
    margin: '4px 0',
    background: '#4b4a44',
    color: '#f0f0e0',
    border: '1px solid #7a7971',
    padding: '2px 4px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  });

  // Ajouter un effet hover
  initiativeButton.find('.initiative-display-button').hover(
    function() { $(this).css('background', '#58574f'); },
    function() { $(this).css('background', '#4b4a44'); }
  );
});

