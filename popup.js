document.addEventListener('DOMContentLoaded', () => {
    const tagsInput = document.getElementById('tags');
    const saveButton = document.getElementById('save');
    const status = document.getElementById('status');

    chrome.storage.sync.get('tagList', (data) => {
        if (data.tagList) {
            tagsInput.value = data.tagList.join(', ');
        }
    });

    saveButton.addEventListener('click', () => {
        const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        chrome.storage.sync.set({ tagList: tags }, () => {
            status.textContent = 'Tags saved!';
            setTimeout(() => (status.textContent = ''), 2000);
        });
    });
});
