(() => {
    let currentHref = window.location.href;
    let isNZ = null;
    if (currentHref.includes("seek.com.au")) {
        isNZ = false;
    } else if (currentHref.includes("seek.co.nz")) {
        isNZ = true;
    } else {
        return;
    }
    console.log(`Seek Tagger running on: ${isNZ ? 'NZ' : 'AU'}...`);

    let jobLinks = document.evaluate(
        "//a[contains(@href, '/job/')]",
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
    );

    let seenJobIds = new Set();
    let jobContexts = new Map();
    const syncer = chrome.storage.sync;

    function createHash(tagList) {
        return tagList
            .sort()
            .join(',')
            .split('')
            .reduce((hash, char) => {
                hash = ((hash << 5) - hash) + char.charCodeAt(0);
                return hash & hash;
            }, 0);
    }

    function createCombinedHash(tagListHash, jobId) {
        return (tagListHash + jobId)
            .split('')
            .reduce((hash, char) => {
                hash = ((hash << 5) - hash) + char.charCodeAt(0);
                return hash & hash;
            }, 0);
    }

    function init(tagList) {
        const tagListHash = createHash(tagList);

        for (let i = 0; i < jobLinks.snapshotLength; i++) {
            let context = jobLinks.snapshotItem(i);
            let href = $(context).attr('href');
            let jobIdMatch = href.match(/\/job\/(\d+)/);

            if (jobIdMatch) {
                let jobId = jobIdMatch[1];
                seenJobIds.add(jobId);
                jobContexts.set(jobId, context);
            }
        }

        seenJobIds.forEach(jobId => {
            let fullUrl = isNZ ? `https://www.seek.co.nz/job/${jobId}` : `https://www.seek.com.au/job/${jobId}`;
            let context = jobContexts.get(jobId);
            let combinedHash = createCombinedHash(tagListHash, jobId);

            syncer.get(jobId, (result) => {
                if (result[jobId] && result[jobId].hash === combinedHash) {
                    sleep(500).then(() => {
                        let cachedTags = result[jobId].tags.join(', ');
                        let injectHTML = `<div style="margin: 5px; padding: 5px; background: greenyellow">${cachedTags}</div>`;
                        $(injectHTML).insertAfter(context);
                    });
                } else {
                    sleep(500).then(() => {
                        $.ajax({
                            url: fullUrl,
                            type: "GET",
                            success: function (response) {
                                let foundTags = [];
                                tagList.forEach(tag => {
                                    let regex = new RegExp(tag, 'i');
                                    if (regex.test(response)) {
                                        foundTags.push(`#${tag}`);
                                    }
                                });

                                let injectHTML = `<div style="margin: 5px; padding: 5px; background: greenyellow">${foundTags.join(', ')}</div>`;
                                $(injectHTML).insertAfter(context);

                                let cacheData = {
                                    [jobId]: { hash: combinedHash, tags: foundTags }
                                };
                                syncer.set(cacheData);
                            }
                        });
                    });
                }
            });
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function setupObserver(tagList) {
        const observer = new MutationObserver(() => {
            const currentJobLinks = document.evaluate(
                "//a[contains(@href, '/job/')]",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            if (currentJobLinks.snapshotLength !== jobLinks.snapshotLength) {
                jobLinks = currentJobLinks;
                seenJobIds.clear();
                jobContexts.clear();
                init(tagList);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    syncer.get('tagList', (data) => {
        const tagList = data.tagList || [];
        init(tagList);
        setupObserver(tagList);
    });
})();