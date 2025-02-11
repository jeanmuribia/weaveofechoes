Commandes consoles

// Confirmer avant d'exécuter la commande
if (confirm("Voulez-vous vraiment supprimer tous les acteurs et leurs données ? Cette action est irréversible.")) {
  // Supprimer tous les acteurs
  const deletedActorIds = [];
  game.actors.forEach(async actor => {
    console.log(`Deleting actor: ${actor.name} (ID: ${actor.id})`);
    deletedActorIds.push(actor.id);
    await actor.delete();
  });

  // Vérifier après suppression
  console.log("Suppression complète des acteurs terminée.");
  console.log("IDs supprimés :", deletedActorIds);
} else {
  console.log("Suppression annulée.");
}
