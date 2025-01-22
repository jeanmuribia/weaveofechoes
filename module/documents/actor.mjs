export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    // Appelons d'abord la méthode parente
    super.prepareData();

    // Accéder aux données du system
    const systemData = this.system || {};

    // S'assurer que les données de base existent
    if (!this.system) this.system = {};
    
    // Initialisation des Focus Points
    if (!systemData.focusPoints) {
      systemData.focusPoints = {
        base: 0,
        current: 0,
        isVisible: false
      };
    }

    // Initialiser Stamina
    if (!systemData.stamina) {
      systemData.stamina = {
        max: 4,
        current: 4
      };
    }

    // Initialiser et valider les attributs
    if (!systemData.attributes) systemData.attributes = {};
    const attributes = ["body", "martial", "soul", "elementary", "mind", "rhetoric"];
    attributes.forEach((attr, index) => {
      if (!systemData.attributes[attr]) {
        systemData.attributes[attr] = {};
      }
      if (!systemData.attributes[attr].baseValue) {
        systemData.attributes[attr].baseValue = "neutral";
      }
      if (!systemData.attributes[attr].currentValue) {
        systemData.attributes[attr].currentValue = systemData.attributes[attr].baseValue;
      }
      if (systemData.attributes[attr].injury === undefined) {
        systemData.attributes[attr].injury = false;
      }
      if (!systemData.attributes[attr].tag1) systemData.attributes[attr].tag1 = "";
      if (!systemData.attributes[attr].tag2) systemData.attributes[attr].tag2 = "";
      if (!systemData.attributes[attr].tag3) systemData.attributes[attr].tag3 = "";
      systemData.attributes[attr].order = index + 1;
    });

    // Initialiser les tempers
    if (!systemData.tempers) systemData.tempers = {};
    const tempers = ["passion", "empathy", "rigor", "independence"];
    tempers.forEach(temper => {
      if (!systemData.tempers[temper]) {
        systemData.tempers[temper] = {};
      }
      if (!systemData.tempers[temper].baseValue) {
        systemData.tempers[temper].baseValue = "neutral";
      }
      if (!systemData.tempers[temper].currentValue) {
        systemData.tempers[temper].currentValue = systemData.tempers[temper].baseValue;
      }
      if (systemData.tempers[temper].injury === undefined) {
        systemData.tempers[temper].injury = false;
      }
    });

    // Initialiser wounds
    if (!systemData.wounds) {
      systemData.wounds = {
        wound1: false,
        wound2: false,
        wound3: false,
        knockedOut: false
      };
    }

    // Initialiser mastery
    if (!systemData.masteryLevel) systemData.masteryLevel = 0;
    if (!systemData.masteryPoints) systemData.masteryPoints = 0;

    // Initialiser les relations
    if (!systemData.relationships) {
      systemData.relationships = {
        connections: []
      };
    } else if (!systemData.relationships.connections) {
      systemData.relationships.connections = [];
    }

    // Initialiser biography
    if (!systemData.biography) {
      systemData.biography = { entries: [] };
    } else if (!Array.isArray(systemData.biography.entries)) {
      systemData.biography.entries = [];
    }
  }

  _getAffinityLabel(value) {
    switch (value) {
        case 1:
            return "Enemy";
        case 2:
            return "Acquaintance";
        case 3:
            return "Friend";
        case 4:
            return "Soulmate";
        default:
            return "Unknown";
    }
}

_getDynamicLabel(value) {
  switch (value) {
      case 0.5:
          return "Superior";
      case 0.7:
          return "Collaborative";
      case 1.0:
          return "Equal";
      case 1.3:
          return "Supportive";
      default:
          return "Unknown";
  }
}
}
// Register Handlebars helpers
Handlebars.registerHelper("capitalize", function(str) {
  if (typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('sort', function(context, field) {
  if (!Array.isArray(context)) return [];
  return context.sort((a, b) => {
    if (a[field] < b[field]) return -1;
    if (a[field] > b[field]) return 1;
    return 0;
  });
});

Handlebars.registerHelper('objectToArray', function(obj) {
  if (typeof obj !== 'object') return [];
  return Object.keys(obj).map(key => {
    return { ...obj[key], key };
  });
});