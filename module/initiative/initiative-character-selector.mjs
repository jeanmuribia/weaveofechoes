export class InitiativeCharacterSelector extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'initiative-character-selector',
            template: 'systems/weave_of_echoes/templates/initiative/character-selector.hbs',
            title: 'Select Characters',
            width: 400,
            height: 600
        });
    }
  
    constructor(tracker) {
      super();
      this.tracker = tracker;
      this.selected = new Set();
    }
  
    getData() {
      return {
        actors: game.actors.filter(a => a.type === "character" || a.type === "npc"),
        selected: this.selected
      };
    }
  
    activateListeners(html) {
      super.activateListeners(html);
  
      html.find('.select-character').click(this._onSelectCharacter.bind(this));
      html.find('.confirm-selection').click(this._onConfirm.bind(this));
    }
  
    _onSelectCharacter(event) {
      const actorId = event.currentTarget.dataset.actorId;
      if (this.selected.has(actorId)) {
        this.selected.delete(actorId);
      } else {
        this.selected.add(actorId);
      }
      this.render();
    }
  
    _onConfirm() {
      const selectedActors = Array.from(this.selected).map(id => game.actors.get(id));
      const initiativeChars = selectedActors.map(actor => new InitiativeChar(actor));
      this.tracker.selectedActors.push(...initiativeChars);
      this.tracker.render();
      this.close();
    }
  }