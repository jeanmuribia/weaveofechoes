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
    const attributes = ["body", "soul", "mind", "martial", "elementary", "rhetoric"];
    attributes.forEach(attr => {
      if (!systemData.attributes[attr]) {
        systemData.attributes[attr] = {}; // Ensure the attribute object exists
      }
      if (!systemData.attributes[attr].baseValue) {
        systemData.attributes[attr].baseValue = "neutral"; // Default base value
      }
      if (!systemData.attributes[attr].currentValue) {
        systemData.attributes[attr].currentValue = systemData.attributes[attr].baseValue;
      }
      if (!systemData.attributes[attr].wounds) {
        systemData.attributes[attr].wounds = {
          wound1: false,
          wound2: false,
          wound3: false
        };
      }
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
      if (!systemData.tempers[temper].wound) {
        systemData.tempers[temper].wound = false; // Default to no trauma
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
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          soul: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          mind: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          martial: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          elementary: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          rhetoric: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
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