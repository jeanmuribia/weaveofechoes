export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system;

    // Initialize Stamina if not present
    if (!systemData.stamina) {
      systemData.stamina = {
        max: 4,
        current: 4
      };
    }

    //initialize Focus Points
    if (!systemData.focusPoints) {
      systemData.focusPoints = {
        base: 0,
        current: 0,
        isVisible: false
      };
    }

    
    // Ensure attributes are initialized for all keys, including "mind" and "elementary"
    const attributes = ["body", "martial", "soul", "elementary", "mind", "rhetoric"];
   
    attributes.forEach((attr, index) => {
      if (!systemData.attributes[attr]) {
        systemData.attributes[attr] = {}; // Assure que l'objet existe
      }
      if (!systemData.attributes[attr].baseValue) {
        systemData.attributes[attr].baseValue = "neutral"; // Valeur par défaut
      }
      if (!systemData.attributes[attr].currentValue) {
        systemData.attributes[attr].currentValue = systemData.attributes[attr].baseValue;
      }
      if (!systemData.attributes[attr].injuries) {
        systemData.attributes[attr].injuries = {
          injury1: false,
          injury2: false,
          injury3: false,
        };
      }
      // Ajoute l'ordre explicite
      systemData.attributes[attr].order = index + 1;
    });

    // Initialize tempers for fire, water, earth, and air
    const tempers = ["fire", "water", "earth", "air"];
    tempers.forEach(temper => {
      if (!systemData.tempers[temper]) {
        systemData.tempers[temper] = {}; // Ensure the temper object exists
      }
      if (!systemData.tempers[temper].baseValue) {
        systemData.tempers[temper].baseValue = "neutral"; // Default base value for temper
      }
      if (!systemData.tempers[temper].currentValue) {
        systemData.tempers[temper].currentValue = systemData.tempers[temper].baseValue; // Default currentValue to baseValue
      }
      if (!systemData.tempers[temper].injury) {
        systemData.tempers[temper].injury = false; // Default to no trauma
      }
    });

    // Initialize relationships if not present
    if (!systemData.relationships) {
      systemData.relationships = [];
    }

    
  }

  /**
   * Create a new actor with default values for attributes
   * 
   * @param {string} name - The actor's name
   * @param {string} type - The actor's type
   */
  static async createActor(name, type) {
    if (!name || name.trim() === "") {
      name = "Unnamed"; // Use "Unnamed" if no name is provided
    }

    // Define initial values for the new actor
    const actorData = {
      name: name || "Unnamed", // Use "Unnamed" if no name is passed
      type: type,
      img: "icons/svg/mystery-man.svg", // Default icon for the actor
      system: {
        name: { value: name }, // Actor's name
        element: { value: "none" }, // Default element value (e.g., "none")
        stamina: {
          max: 4, // Default Stamina Max value
          current: 4 // Default Current Stamina value
        },
        tempers: {
          fire: { value: "neutral" }, // Default fire temper value
          water: { value: "neutral" }, // Default water temper value
          earth: { value: "neutral" }, // Default earth temper value
          air: { value: "neutral" } // Default air temper value
        },
        attributes: {
          // Initialize all attributes with default values
          body: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          },
          soul: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          },
          mind: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          },
          martial: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          },
          elementary: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          },
          rhetoric: {
            baseValue: "neutral",
            currentValue: "neutral",
            injuries: { injury1: false, injury2: false, injury3: false }
          }
        },
        relationships: [] // Default relationships array
      }
    };

    // Create a new actor in the Foundry system
    await Actor.create(actorData);
  }

  
}
WoeActor.prototype.calculateBaseFocusPoints = function (groupMembers) {
  let baseFocus = 0;

  groupMembers.forEach(memberName => {
      const member = game.actors.getName(memberName);
      const relation = this.system.relationships.find(r => r.characterName === memberName);

      if (relation && relation.relationshipLevel < 0) {
          baseFocus -= Math.abs(relation.relationshipLevel);  // Chaque relation négative réduit le focus
      }
  });

  // Utiliser update pour mettre à jour les Focus Points de base
  this.update({ 'system.focusPoints.base': Math.max(0, baseFocus) });
};
WoeActor.prototype.modifyCurrentFocusPoints = async function (amount) {
  const newCurrent = Math.max(0, this.system.focusPoints.current + amount);
  await this.update({ 'system.focusPoints.current': newCurrent });
  
  // Forcer le rendu de la fiche après la mise à jour
  if (this.sheet) {
    this.sheet.render(false); // Forcer un re-render
  }
};

Handlebars.registerHelper("capitalize", function (str) {
  if (typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('sort', function (context, field) {
  if (!Array.isArray(context)) return [];
  return context.sort((a, b) => {
    if (a[field] < b[field]) return -1;
    if (a[field] > b[field]) return 1;
    return 0;
  });
});

Handlebars.registerHelper('objectToArray', function (obj) {
  if (typeof obj !== 'object') return [];
  return Object.keys(obj).map(key => {
    return { ...obj[key], key }; // Ajoute la clé pour accéder dans le Handlebars
  });
});