// biography-system.mjs
export class BiographySystem {
  static setup(html, actor) {
    this.setupAddEntry(html, actor);
    this.setupEntryControls(html, actor);
    this.setupTitleEditing(html, actor);
    this.setupViewerSelection(html, actor);
    this.setupContentEditing(html, actor);
    this.checkEntryPermissions(html, actor);
    
  }

  static setupAddEntry(html, actor) {
    html.find("#add-entry").click(async () => {
   
      const entries = actor.system.biography?.entries || [];
      entries.push({
        title: "New Entry",
        content: "",
        viewers: []
      });
      await actor.update({ "system.biography.entries": entries });
    });
  }

  static setupEntryControls(html, actor) {
    // Toggle content visibility
    html.find(".toggle-expand").click((event) => {
      const content = $(event.currentTarget).closest(".entryContainer").find(".entryContent");
      content.toggleClass("visible");
      const icon = $(event.currentTarget).find("i");
      icon.toggleClass("fa-caret-down fa-caret-up");
    });

    // Delete entry
    html.find(".delete-entry").click(async (event) => {
      if (!await Dialog.confirm({
        title: "Delete Entry",
        content: "Are you sure you want to delete this entry?",
        defaultYes: false
      })) return;
      
      const index = $(event.currentTarget).closest(".entryContainer").data("index");
      const entries = actor.system.biography?.entries || [];
      entries.splice(index, 1);
      await actor.update({ "system.biography.entries": entries });
    });

    // Tooltips
    html.find('.select-pj-icon').attr('data-tooltip', 'Choose visibility for other characters');
    html.find('.delete-entry').attr('data-tooltip', 'Delete this entry');
    html.find('.pj-avatar').each(function() {
      $(this).attr('data-tooltip', $(this).attr('title'));
    });
  }

  // Fonctions de gestion des permissions et de l'affichage dans BiographySystem

static checkEntryPermissions(html, actor) {
  const entries = actor.system.biography?.entries || [];

  entries.forEach((entry, index) => {
    const container = html.find(`.entryContainer[data-index="${index}"]`);
    const viewers = Array.isArray(entry.viewers) ? entry.viewers : [];
    
    if (actor.isOwner || game.user.isGM) {
      // Full access for actor owner and GM
      return; // Keep all controls visible and interactive
    } else if (this.userHasViewPermission(game.user, viewers)) {
      // Read-only mode for authorized viewers
      this.setReadOnlyMode(container);
    } else {
      // No access - show restricted
      this.restrictEntry(container, actor);
    }
  });
}

static userHasViewPermission(user, viewers = []) {
  // Si viewers n'est pas défini ou n'est pas un tableau, retourner false
  if (!Array.isArray(viewers)) return false;

  // Check if user's characters are in the viewers list
  return game.actors
    .filter(a => a.ownership?.[user.id] === 3) // Get all actors owned by user
    .some(a => viewers.includes(a.id)); // Check if any are in viewers list
}

static getOwnerName(actor) {
  if (!actor) return "the owner";

  // Si c'est un GM qui restreint, on retourne "GM"
  if (game.user.isGM) return "GM";

  // Sinon on cherche le propriétaire de l'acteur
  const owner = Object.entries(actor.ownership)
    .find(([userId, level]) => level === 3 && userId !== game.user.id);

  if (owner) {
    const user = game.users.get(owner[0]);
    return user?.name || "the owner";
  }

  return "the owner";
}

static setReadOnlyMode(container) {
  // Remove all edit controls but keep content visible
  container.addClass('read-only');
  container.find('.entryTitle').attr('contenteditable', 'false');
  container.find('.editor-wrapper').remove();
  container.find('.entry-buttons').remove();
  container.find('.visibility-entry').remove();
  container.find('.selected-avatars').remove(); // Masquer les avatars en mode lecture seule
  
  // Disable any click events on the preview pane
  container.find('.preview-pane').css('cursor', 'default').off('click');
  
  // Make sure the content is visible but not interactive
  container.find('.content-wrapper').addClass('read-only');
}

static restrictEntry(container, actor) {
  // Update the title to "Restricted"
  container.find('.entryTitle')
    .text("Restricted")
    .attr('contenteditable', 'false')
    .addClass('restricted-title');

  // Update the content area with the restricted message
  const ownerName = BiographySystem.getOwnerName(actor);
  container.find('.preview-pane').html(`
    <div class="preview-content">
      Visibility restricted by ${ownerName}
    </div>
  `);

  // Disable interactions but keep the entry visible
  container.addClass('no-interaction');
  container.find('.editor-wrapper').remove();
  container.find('.entry-buttons').remove();
  container.find('.visibility-entry').remove();
  container.find('.selected-avatars').remove();
}


  static setupTitleEditing(html, actor) {
    // Limite de caractères pour le titre
    html.find(".entryTitle").on("input", function() {
      const maxLength = 34;
      if (this.textContent.length > maxLength) {
        this.textContent = this.textContent.substring(0, maxLength);
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(this.childNodes[0], maxLength);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    // Sauvegarde du titre au blur
    html.find(".entryTitle").on("blur", async function() {
      const index = $(this).closest(".entryContainer").data("index");
      const entries = actor.system.biography?.entries || [];
      if (entries[index]) {
        entries[index].title = this.textContent.trim();
        await actor.update({ "system.biography.entries": entries });
      }
    });
  }

  static setupContentEditing(html, actor) {
  
    html.find('.preview-pane').click((event) => {
      const container = $(event.currentTarget).closest('.entryContainer');
      const editorWrapper = container.find('.editor-wrapper');
      const saveButton = container.find('.save-entry');
  
      // Basculer l'état de l'éditeur (ouvrir/fermer)
      if (editorWrapper.hasClass('active')) {
        editorWrapper.removeClass('active').slideUp(300); // Ré-enrouler
      } else {
        editorWrapper.addClass('active').slideDown(300); // Dérouler
        saveButton.addClass('disabled'); // Désactiver Save tant qu'aucune modification n'est faite
      }
    });
  
    // Mise à jour en temps réel de la preview
    html.find('.markdown-editor').on('input', function () {
      const container = $(this).closest('.entryContainer');
      const previewPane = container.find('.preview-pane');
      const saveButton = container.find('.save-entry');
      const markdown = $(this).val();
  
      // Mettre à jour la prévisualisation
      if (markdown.trim()) {
        previewPane.html(BiographySystem.markdownToHtml(markdown));
      } else {
        previewPane.html('<em>Your entry content</em>');
      }
  
      // Activer le bouton Save
      saveButton.addClass('enabled').removeClass('disabled');
    });
  
    // Sauvegarde au clic sur Save
    html.find('.save-entry').click(async function () {
      const saveButton = $(this);
      if (saveButton.hasClass('disabled')) return;
  
      const container = $(this).closest('.entryContainer');
      const markdownEditor = container.find('.markdown-editor');
      const markdown = markdownEditor.val();
      const index = container.data('index');
  
      // Sauvegarder le contenu
      const entries = actor.system.biography?.entries || [];
      if (entries[index]) {
        entries[index].content = markdown;
        await actor.update({ "system.biography.entries": entries });
  
        // Désactiver le bouton Save
        saveButton.addClass('disabled').removeClass('enabled');
      }
    });
  
    // Actions des boutons Markdown
    html.find('.md-button').click(function () {
      const button = $(this);
      const markdownSyntax = button.data('md');
      const container = button.closest('.entryContainer');
      const markdownEditor = container.find('.markdown-editor')[0];
      const saveButton = container.find('.save-entry');
  
      // Gestion des insertions Markdown
      const start = markdownEditor.selectionStart;
      const end = markdownEditor.selectionEnd;
      const text = markdownEditor.value;
  
      const before = text.substring(0, start);
      const after = text.substring(end);
      const selectedText = text.substring(start, end);
      markdownEditor.value = `${before}${markdownSyntax}${selectedText}${markdownSyntax}${after}`;
  
      // Actualiser la prévisualisation
      const updatedMarkdown = markdownEditor.value;
      const previewPane = container.find('.preview-pane');
      previewPane.html(BiographySystem.markdownToHtml(updatedMarkdown));
  
      // Activer le bouton Save
      saveButton.addClass('enabled').removeClass('disabled');
    });
  }
  
  static setupAutoSave(html, actor) {
  
    // Définir un intervalle de sauvegarde toutes les 5 minutes (300000 ms)
    setInterval(async () => {
  
  
      // Parcourir chaque éditeur actif pour sauvegarder le contenu
      html.find('.entryContainer').each(async function () {
        const container = $(this);
        const markdownEditor = container.find('.markdown-editor');
  
        // Si un éditeur existe (et est actif ou modifié)
        if (markdownEditor.length > 0) {
          const markdown = markdownEditor.val();
          const index = container.data('index');
  
          // Vérifier que l'entrée existe
          const entries = actor.system.biography?.entries || [];
          if (entries[index]) {
            // Si le contenu a changé, on met à jour
            if (entries[index].content !== markdown) {
              entries[index].content = markdown;
              try {
                await actor.update({ "system.biography.entries": entries });
                console.log(`Auto-saved entry ${index}.`);
              } catch (error) {
                console.error(`Failed to auto-save entry ${index}:`, error);
              }
            }
          }
        }
      });
    }, 300000); // Intervalle de 5 minutes

    
  }
  
  
  static async saveContent(contentDiv, actor, markdown) {
    try {
      const index = contentDiv.closest('.entryContainer').data('index');
      const entries = actor.system.biography?.entries || [];
  
      if (entries[index]) {
        entries[index].content = markdown; // Met à jour le contenu dans l'objet
        await actor.update({ "system.biography.entries": entries });
      }
    } catch (error) {
      console.error('Error saving content:', error);
    }
  }

  static markdownToHtml(markdown) {
    if (!markdown) return '';
  
    return markdown
      .replace(/^# (.+)$/gm, '<h4 class="markdown-title">$1</h4>') // Titres avec h4
      .replace(/^## (.+)$/gm, '<h5>$1</h5>') // Optionnel : autre niveau de titre
      .replace(/^### (.+)$/gm, '<h6>$1</h6>') // Optionnel : encore plus petit
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Gras
      .replace(/\*(.+?)\*/g, '<em>$1</em>') // Italique
      .replace(/^- (.+)$/gm, '<li>$1</li>') // Listes
      .replace(/\n/g, '<br>'); // Retours à la ligne
  }
  
  static setupViewerSelection(html, actor) {
   
  
    html.find(".visibility-entry").click(async (event) => {

      const container = $(event.currentTarget).closest(".entryContainer");
      const index = container.data("index");
  
      const entries = actor.system.biography?.entries || [];
      const currentEntry = entries[index];
      const characters = game.actors.filter(a => a.id !== actor.id); // Exclure l'acteur actuel
  
      // Générer le contenu de la modale
      const content = `
        <div class="select-pj">
          <ul>
            ${characters.map(char => `
              <li data-id="${char.id}" class="${(currentEntry.viewers || []).includes(char.id) ? 'selected' : ''}">
                <img src="${char.img || 'icons/svg/mystery-man.svg'}" alt="${char.name}">
                <label>${char.name}</label>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
  
      new Dialog({
        title: "Manage Visibility",
        content: content,
        buttons: {
          confirm: {
            label: "Save",
            callback: async (html) => {
              const selectedIds = Array.from(html.find('li.selected')).map(el => $(el).data('id'));
  
              if (entries[index]) {
                entries[index].viewers = selectedIds;
                await actor.update({ "system.biography.entries": entries });
              }
            },
          },
          cancel: { label: "Cancel" },
        },
        render: (html) => {
          html.find("li").click(function () {
            $(this).toggleClass("selected");
          });
        },
      }).render(true);
    });
  }
  
  
}