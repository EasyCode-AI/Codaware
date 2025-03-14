// Add functions to create and manage chips
function createChipsContainer(inputFieldParentContainer) {
    let container = document.getElementById('file-chips-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'file-chips-container';
      container.style.cssText = `
        padding: 4px 0px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      `;
      inputFieldParentContainer.prepend(container);
    }
    return container;
  }
  
// Clear cache when chip is removed
function createFileChip(suggestion) {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.setAttribute('data-file', suggestion.label); // Add data attribute to identify the file
    chip.style.cssText = `
      background: #2A2B32;
      border: 1px solid #565869;
      border-radius: 10px;
      padding: 4px 8px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: white;
    `;
    
    const icon = suggestion.type === 'folder' ? '📁' : '📄';
    chip.textContent = `${icon} ${suggestion.label}`;
    
    const removeBtn = document.createElement('span');
    removeBtn.textContent = '×';
    removeBtn.style.marginLeft = '4px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.onclick = () => {
      chip.remove();
    };
    chip.appendChild(removeBtn);
    
    return chip;
  }
  
  // Modify processFileChips to use cached content
async function processFileChips(fileChips) {
  return Promise.all(
    Array.from(fileChips).map(async chip => {
      const label = chip.textContent.split('×')[0].trim().slice(2).trim();

      try {
        let content = fileContentCache[label];
        if (!content) {
          content = await getFileContents(label);
          // Ensure content is properly formatted before caching
          content = content.replace(/\r\n/g, '\n').trim();
          fileContentCache[label] = content;
          console.log("Initial file retrieval");
        } else {
          console.log("Cached file retrieval");
        }
        // console.log("file content:\n", content);
        // Add explicit formatting for the file content
        return `filepath:${label}\n\`\`\`\n${content}\n\`\`\`\n`;
      } catch (error) {
        console.error('Error getting content for', label, error);      
        alert(`File: ${label}\n\`\`\`\nError loading file content\n\`\`\`\n`);
      }
    })
  );
}

// Helper function to append file contents to message
async function appendFileContentsToMessage(fileContents) {
  const platform = getCurrentPlatform();
  const editor = document.querySelector(platform.selectors.editor);
  const currentText = editor.innerText;
  
  // Format the file contents with proper paragraph tags
  const formattedFileContents = fileContents.map(content => {
    return content
      .split('\n')
      .map(line => {
        const escapedLine = line
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<p>${escapedLine || '<br class="ProseMirror-trailingBreak">'}</p>`;
      })
      .join('');
  });

  const newText = `${currentText}\n\nReferenced Files:\n${formattedFileContents.join('\n\n')}`;

  if (platform.inputFieldType === 'contenteditable') {
    editor.innerHTML = newText;
  } else {
    editor.value = newText;
  }

  // Dispatch appropriate input event based on platform
  const event = platform.inputFieldType === 'contenteditable' 
    ? new InputEvent('input', { bubbles: true, cancelable: true })
    : new Event('input', { bubbles: true });
  
  // needed otherwise the file doesn't get injected in time before the submission
  await new Promise(resolve => setTimeout(resolve, 500));

  editor.dispatchEvent(event);
}
