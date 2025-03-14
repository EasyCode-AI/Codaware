// content.js

async function initializeMentionExtension(inputField) {
  inputField.classList.add('mention-extension-enabled');

  // Add single keyboard event listeners that delegate to menu handler
  inputField.addEventListener('keydown', (event) => {
    handleMenuKeyboardEvents(event, inputField);
  }, { capture: true, passive: false });

  inputField.addEventListener('keyup', (event) => {
    handleMenuKeyboardEvents(event, inputField);
  }, true);

  // Close context menu on click outside
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('mention-context-menu');
    const isAddContextButton = event.target.classList.contains('add-context-btn');

    if (menu && !menu.contains(event.target) && !isAddContextButton) {
      removeContextMenu();
    }
  });
}

let inputFieldParentContainer;

// Wrap the observer initialization in a function
function initializeObservers() {
  const observer = new MutationObserver(() => {
    const selectors = getSelectors();
    if (!selectors) return;

    // Add button to input container
    const inputFieldContainer = getInputFieldContainer();

    if (inputFieldContainer) {
      const chipsContainer = createChipsContainer(inputFieldContainer);
      addContextButton(chipsContainer);
      addSettingsButton(chipsContainer);
    } else {
      console.log("no found");
    }

    const inputField = document.querySelector(selectors.inputField);
    if (inputField && !inputField.classList.contains('mention-extension-enabled')) {
      initializeMentionExtension(inputField);
    }
  });

  // Code block observer
  const codeBlockObserver = new MutationObserver((mutations) => {
    const platform = getCurrentPlatform();
    if (!platform) return;

    const selectors = platform.selectors;
    const codeBlockSelector = selectors.codeBlock;

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for code blocks using platform-specific selector
            if (node.matches(codeBlockSelector)) {
              addCodeBlockButton(
                node, 
                platform === PLATFORMS.CHATGPT ? 'chatgpt' : 'claude'
              );
            }
            
            // Also check children using platform-specific selector
            const codeBlocks = node.querySelectorAll(codeBlockSelector);
            codeBlocks.forEach(codeBlock => {
                addCodeBlockButton(
                  codeBlock,
                  platform === PLATFORMS.CHATGPT ? 'chatgpt' : 'claude'
                );
            });
          }
        });
      }
    });
  });

  // Function to start observers
  function startObservers() {
    if (document.body) {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      codeBlockObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // Check document readiness and initialize accordingly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObservers);
  } else {
    startObservers();
  }

  // Backup timeout in case DOMContentLoaded already fired
  setTimeout(startObservers, 1000);
}

// Initialize everything
initializeObservers();

// Initialize code block buttons with proper timing
function initializeCodeBlockButtons() {
  //addButtonsToCodeBlocks();
  setTimeout(addButtonsToCodeBlocks, 1000);
  //setInterval(addButtonsToCodeBlocks, 2000);
}

// Start the code block button initialization
if (document.readyState === 'loading') {
  console.log("page still loading, wait for DOM load");
  document.addEventListener('DOMContentLoaded', initializeCodeBlockButtons);
} else {
  console.log("page loaded, attempting to add buttons");
  initializeCodeBlockButtons();
}

// Insert mention content
async function insertMentionContent(inputField, suggestion) {
  const container = createChipsContainer(inputField);
  
  // Check if chip already exists for this file
  const existingChips = container.getElementsByClassName('file-chip');
  let hasChipAlready = false;
  for (const chip of existingChips) {
    if (chip.getAttribute('data-file') === suggestion.label) {
      hasChipAlready = true;
      console.log("already has chip");
      // Chip already exists, don't add duplicate
    } else {
      console.log("NOT has chip");
    }
  }

  if (hasChipAlready) {

  } else {
    const chip = createFileChip(suggestion);
    container.appendChild(chip);
  }

  if (!(suggestion.label in fileContentCache) && suggestion.type !== 'folder') {
    getFileContents(suggestion.label)
      .then(content => {
        fileContentCache[suggestion.label] = content;
      })
      .catch(error => {
        console.error('Error caching file content:', error);
      });
  }

  // Clean up '>' character and add file name
  const currentText = inputField.value || inputField.innerText;
  if (currentText.endsWith('>')) {
    const newText = currentText.slice(0, -1) + `file: ${suggestion.label} `;
    if (inputField.value !== undefined) {
      inputField.value = newText;
    } else {
      inputField.innerText = newText;
    }
  }

  // Set cursor position
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(inputField);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  removeContextMenu();
}

// Get input field
function getInputField() {
  const selectors = getSelectors();
  return document.querySelector(selectors.inputField);
}

function addContextButton(inputFieldContainer) {
  // Check if button already exists
  if (inputFieldContainer.querySelector('.add-context-btn')) {
    return;
  }

  // Create button
  const button = document.createElement('button');
  button.className = 'add-context-btn';
  button.innerHTML = '+ Add Context';
  button.style.cssText = `
    top: 10px;
    left: 10px;
    padding: 6px 12px;
    background-color: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 15px;
    cursor: pointer;
    font-size: 12px;
    z-index: 1000;
  `;

  // Add hover effect
  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#444';
  });
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#333';
  });

  // Add click handler
  button.addEventListener('click', () => {
    const inputField = getInputField();
    if (inputField) {
      // Simulate typing '>' by creating and showing the file menu

      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      showContextMenu(getInputFieldContainer(), range, "");
    }
  });

  // Insert as first child
  inputFieldContainer.prepend(button);
}

function addSettingsButton(inputFieldContainer) {
  // Check if link already exists
  if (inputFieldContainer.querySelector('.settings-link')) {
    return;
  }

  // Create container for right alignment
  const linkContainer = document.createElement('div');
  linkContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    position: absolute;
    right: 10px;
    z-index: 1000;
  `;

  // Create settings link
  const link = document.createElement('span');
  link.className = 'settings-link';
  link.innerHTML = 'EasyCode Settings';
  link.style.cssText = `
    color: #888;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 8px;
    opacity: 1;
    transition: opacity 0.2s, color 0.2s;
    font-family: Arial, sans-serif;
  `;

  // Add hover effect
  link.addEventListener('mouseover', () => {
    link.style.opacity = '1';
    link.style.color = '#aaa';
  });
  link.addEventListener('mouseout', () => {
    link.style.opacity = '1';
    link.style.color = '#888';
  });

  // Add click handler to open options page
  link.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  });

  // Add link to container and container to inputFieldContainer 
  linkContainer.appendChild(link);
  inputFieldContainer.appendChild(linkContainer);

  // Platform-specific adjustments
  const platform = getCurrentPlatform();
  if (platform === PLATFORMS.CHATGPT) {
    linkContainer.style.top = '8px';
    linkContainer.style.right = '8px';
  } else if (platform === PLATFORMS.CLAUDE) {
    linkContainer.style.top = '10px';
    linkContainer.style.right = '10px';
  }
}