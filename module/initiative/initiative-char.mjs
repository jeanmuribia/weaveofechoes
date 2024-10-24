export class InitiativeChar {
    constructor(actor) {
      this.id = randomID();
      this.name = actor.name;
      this.img = actor.img;
      this.actorId = actor.id;
      this.initiative = null;
    }
  }