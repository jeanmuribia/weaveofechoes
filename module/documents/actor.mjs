export class WoeActor extends Actor {
  prepareData() {
    super.prepareData();
    const systemData = this.system;

    // Check for name
    if (!systemData.name) {
      systemData.name = { value: "Unnamed" };
    }

    // Check for element
    if (!systemData.element) {
      systemData.element = { value: "none" }; // Default value
    }

    // Initialize tempers
    if (!systemData.tempers) {
      systemData.tempers = {
        fire: { value: "neutral" },
        water: { value: "neutral" },
        earth: { value: "neutral" },
        air: { value: "neutral" }
      };
    }

    // Initialize attributes
    if (!systemData.attributes) {
      systemData.attributes = {
        body: { value: "neutral" },
        soul: { value: "neutral" },
        spirit: { value: "neutral" },
        martial: { value: "neutral" },
        elemental: { value: "neutral" },
        rhetoric: { value: "neutral" }
      };
    }
  }
}
