document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const listContainer = document.getElementById('comprehension-list');
    const listView = document.getElementById('list-view');
    const readingView = document.getElementById('reading-view');
    const questionView = document.getElementById('question-view');
    const appContainer = document.getElementById('app-container'); // For view switching
    const themeSwitcher = document.querySelector('.theme-switcher');

    // Reading View Elements
    const comprehensionTitle = document.getElementById('comprehension-title');
    const comprehensionContent = document.getElementById('comprehension-content');
    const startQuestionsButton = document.getElementById('start-questions-button');

    // Question View Elements
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const showAnswerButton = document.getElementById('show-answer-button');
    const correctAnswerEl = document.getElementById('correct-answer');
    const prevQuestionButton = document.getElementById('prev-question-button');
    const nextQuestionButton = document.getElementById('next-question-button');
    const finishButton = document.getElementById('finish-button');


    // --- State Variables ---
    let allComprehensions = []; // To store data from all JSON files
    let currentComprehension = null;
    let currentQuestionIndex = 0;
    // REMOVED: const dataFiles = [...] - We will load this from manifest.json

    // --- Functions ---

    /**
     * Fetches data from a single JSON file. Handles fetch and JSON parsing errors.
     * @param {string} url - The path to the JSON file.
     * @returns {Promise<{url: string, data: Array|null, error: string|null}>}
     *          - Resolves with an object containing the url, data (or null on error),
     *            and an error message (or null on success).
     */
    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Try parsing the JSON
            try {
                const data = await response.json();
                // Basic validation: Check if it's an array (as expected)
                if (!Array.isArray(data)) {
                     throw new Error("JSON data is not an array.");
                }
                return { url, data, error: null }; // Success
            } catch (parseError) {
                 throw new Error(`JSON parsing error: ${parseError.message}`);
            }
        } catch (error) {
            console.error(`Failed to fetch or parse data from: ${url}`, error);
            // Return an object indicating failure for this specific file
            return { url, data: null, error: error.message };
        }
    }

    /**
     * Loads the list of data files from manifest.json, then fetches data
     * from each listed file, skipping files that fail to load or parse.
     */
    async function loadAllData() {
        listContainer.innerHTML = '<li class="loading">Loading comprehensions...</li>';
        let filesToLoad = [];
        let failedFiles = []; // Keep track of files that couldn't be loaded

        // 1. Fetch the manifest file
        try {
            const manifestResponse = await fetch('data/manifest.json');
            if (!manifestResponse.ok) {
                throw new Error(`HTTP error! status: ${manifestResponse.status}`);
            }
            const manifestData = await manifestResponse.json();
            if (manifestData && Array.isArray(manifestData.dataFiles)) {
                filesToLoad = manifestData.dataFiles;
            } else {
                throw new Error("Manifest file is missing 'dataFiles' array.");
            }
        } catch (error) {
            console.error("Failed to load or parse manifest.json:", error);
            listContainer.innerHTML = '<li class="loading">Error: Could not load the list of comprehensions. Manifest file missing or invalid.</li>';
            return; // Stop loading if manifest fails
        }

        if (filesToLoad.length === 0) {
             listContainer.innerHTML = '<li class="loading">No comprehension files listed in manifest.json.</li>';
             return;
        }

        // 2. Fetch all data files listed in the manifest
        const fetchPromises = filesToLoad.map(fileUrl => fetchData(fileUrl));

        try {
            // Promise.allSettled waits for all promises, regardless of success/failure
            const results = await Promise.allSettled(fetchPromises);

            allComprehensions = []; // Reset comprehensions
            failedFiles = []; // Reset failed files list

            results.forEach(result => {
                // Check if the promise was fulfilled and data is valid
                if (result.status === 'fulfilled' && result.value.data !== null) {
                    // Add the valid data from this file to the main array
                    allComprehensions = allComprehensions.concat(result.value.data);
                } else {
                    // Log failed files (either fetch error or fulfilled with error)
                    const url = result.status === 'fulfilled' ? result.value.url : result.reason?.url || 'Unknown URL'; // Try to get URL even from rejection
                    const errorMessage = result.status === 'fulfilled' ? result.value.error : result.reason?.message || 'Fetch rejected';
                    failedFiles.push({ url: url, reason: errorMessage });
                    console.warn(`Skipping file due to error: ${url} - Reason: ${errorMessage}`);
                }
            });

            // 3. Display results or error messages
            if (allComprehensions.length === 0) {
                let errorMessage = '<li class="loading">No valid comprehensions found.';
                if (failedFiles.length > 0) {
                    errorMessage += ` ${failedFiles.length} file(s) failed to load. Check console for details.`;
                }
                 errorMessage += '</li>';
                 listContainer.innerHTML = errorMessage;
            } else {
                displayComprehensionList();
                if (failedFiles.length > 0) {
                    // Optionally, display a non-blocking warning to the user
                    console.warn(`${failedFiles.length} data file(s) failed to load and were skipped:`, failedFiles.map(f => f.url));
                    // You could add a small, dismissible message to the UI if desired
                }
            }

        } catch (error) {
            // This catch is less likely with Promise.allSettled, but good practice
            console.error("An unexpected error occurred during data loading:", error);
            listContainer.innerHTML = '<li class="loading">An unexpected error occurred while loading comprehensions.</li>';
        }
    }

    /**
     * Displays the list of comprehensions in the UI.
     * (No changes needed in this function itself)
     */
    function displayComprehensionList() {
        listContainer.innerHTML = ''; // Clear loading/previous list
        if (allComprehensions.length === 0) {
            // This case is handled more specifically in loadAllData now
            listContainer.innerHTML = '<li class="loading">No comprehensions available.</li>';
            return;
        }

        allComprehensions.forEach(comp => {
            // Basic validation: Ensure essential properties exist before creating list item
            if (!comp || !comp.id || !comp.title || !comp.source) {
                console.warn('Skipping invalid comprehension item:', comp);
                return; // Skip this item
            }
            const listItem = document.createElement('li');
            listItem.textContent = `${comp.title} (${comp.source})`;
            listItem.dataset.id = comp.id; // Store ID for later retrieval
            listItem.setAttribute('tabindex', '0'); // Make it focusable
            listItem.addEventListener('click', () => selectComprehension(comp.id));
            listItem.addEventListener('keydown', (e) => { // Allow selection with Enter key
                 if (e.key === 'Enter') {
                    selectComprehension(comp.id);
                 }
            });
            listContainer.appendChild(listItem);
        });
    }

    /**
     * Switches the currently visible view.
     * (No changes needed in this function)
     */
    function switchView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active-view');
        });

        // Show the target view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active-view');
            // Scroll to top of the new view
             window.scrollTo(0, 0);
             // Try to focus the first focusable element in the new view (good for TV)
             const firstFocusable = targetView.querySelector('button, [tabindex="0"]');
             if(firstFocusable) {
                firstFocusable.focus();
             }
        } else {
            console.error("View not found:", viewId);
            // Default back to list view if target is invalid
            listView.classList.add('active-view');
            listView.querySelector('li[tabindex="0"]')?.focus(); // Focus first list item
        }
    }


    /**
     * Handles the selection of a comprehension from the list.
     * (Minor improvement: Added check for questions array)
     * @param {string} id - The ID of the selected comprehension.
     */
    function selectComprehension(id) {
        currentComprehension = allComprehensions.find(comp => comp && comp.id === id); // Added check for comp existence
        if (!currentComprehension) {
            console.error("Comprehension not found for ID:", id);
            alert("Sorry, there was an error loading the details for this item."); // User feedback
            return;
        }
         // Ensure questions array exists, default to empty if not
         if (!Array.isArray(currentComprehension.questions)) {
            console.warn(`Comprehension "${currentComprehension.title}" (ID: ${id}) is missing a valid 'questions' array.`);
            currentComprehension.questions = [];
         }


        // Populate Reading View
        comprehensionTitle.textContent = currentComprehension.title;
        comprehensionContent.innerHTML = ''; // Clear previous content

        if (currentComprehension.type === 'text') {
            if (typeof currentComprehension.content === 'string') {
                // Basic sanitization (consider a more robust library if needed)
                const safeContent = currentComprehension.content
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                comprehensionContent.innerHTML = `<p>${safeContent.replace(/\n/g, '<br>')}</p>`;
            } else {
                 comprehensionContent.innerHTML = `<p>Error: Invalid text content.</p>`;
                 console.error("Invalid text content for:", currentComprehension.id);
            }
        } else if (currentComprehension.type === 'picture') {
            if (typeof currentComprehension.content === 'string' && currentComprehension.content.trim() && !currentComprehension.content.startsWith('http') && !currentComprehension.content.startsWith('/')) {
                 const img = document.createElement('img');
                 img.src = currentComprehension.content;
                 img.alt = currentComprehension.title || "Comprehension image"; // Add default alt text
                 img.onerror = () => { // Handle image loading errors
                     comprehensionContent.innerHTML = `<p>Error: Image could not be loaded (${currentComprehension.content}).</p>`;
                     console.error("Failed to load image:", currentComprehension.content);
                 };
                 comprehensionContent.appendChild(img);
            } else {
                 comprehensionContent.innerHTML = `<p>Error: Invalid or missing image path.</p>`;
                 console.error("Invalid image path:", currentComprehension.content);
            }
        } else {
             comprehensionContent.innerHTML = `<p>Error: Unknown comprehension type "${currentComprehension.type}".</p>`;
             console.error("Unknown comprehension type:", currentComprehension.type);
        }

        // Reset question state
        currentQuestionIndex = 0;

        // Enable/disable start button based on questions
        startQuestionsButton.disabled = currentComprehension.questions.length === 0;


        // Switch to Reading View
        switchView('reading-view');
    }

    /**
     * Starts the question sequence for the current comprehension.
     * (No changes needed in this function)
     */
    function startQuestions() {
        // The check is implicitly handled by the disabled state of the button now
        // but keeping an explicit check is good defensive programming.
        if (!currentComprehension || !currentComprehension.questions || currentComprehension.questions.length === 0) {
            console.error("Attempted to start questions when none are available or comprehension not selected.");
            return;
        }
        currentQuestionIndex = 0;
        displayQuestion();
        switchView('question-view');
    }

    /**
     * Displays the current question based on currentQuestionIndex.
     * (Minor validation added)
     */
    function displayQuestion() {
        if (!currentComprehension || !currentComprehension.questions || currentComprehension.questions.length === 0) return;

        const question = currentComprehension.questions[currentQuestionIndex];

        // Validate question structure
        if (!question || typeof question.questionText !== 'string' || typeof question.correctAnswer !== 'string') {
             console.error(`Invalid question structure at index ${currentQuestionIndex} for comprehension ${currentComprehension.id}:`, question);
             // Optionally skip this question or show an error
             questionNumberEl.textContent = `Error`;
             questionTextEl.textContent = "Error loading this question.";
             correctAnswerEl.classList.add('hidden');
             showAnswerButton.disabled = true;
             // Still allow navigation if possible
             prevQuestionButton.disabled = currentQuestionIndex === 0;
             nextQuestionButton.disabled = currentQuestionIndex >= currentComprehension.questions.length - 1; // Use >= to handle error case
             finishButton.classList.toggle('hidden', currentQuestionIndex < currentComprehension.questions.length - 1);
             nextQuestionButton.classList.toggle('hidden', currentQuestionIndex >= currentComprehension.questions.length - 1);
             return;
        }


        questionNumberEl.textContent = `Question ${currentQuestionIndex + 1} of ${currentComprehension.questions.length}`;
        questionTextEl.textContent = question.questionText;

        // Hide answer initially
        correctAnswerEl.textContent = `Answer: ${question.correctAnswer}`; // Basic sanitization might be needed here too if answers contain HTML
        correctAnswerEl.classList.add('hidden');
        showAnswerButton.disabled = false; // Enable show answer button

        // Update button states
        const isLastQuestion = currentQuestionIndex === currentComprehension.questions.length - 1;
        prevQuestionButton.disabled = currentQuestionIndex === 0;
        nextQuestionButton.disabled = isLastQuestion;
        finishButton.classList.toggle('hidden', !isLastQuestion);
        nextQuestionButton.classList.toggle('hidden', isLastQuestion);

        // Focus the "Show Answer" button when a new question loads
        showAnswerButton.focus();
    }

    /**
     * Shows the correct answer for the current question.
     * (No changes needed in this function)
     */
    function showAnswer() {
        correctAnswerEl.classList.remove('hidden');
        showAnswerButton.disabled = true; // Disable after showing
        // Optional: Focus next/finish button after showing answer
        const isLastQuestion = currentQuestionIndex === currentComprehension.questions.length - 1;
        if (!isLastQuestion && !nextQuestionButton.disabled) {
            nextQuestionButton.focus();
        } else if (isLastQuestion && !finishButton.disabled) {
            finishButton.focus();
        }
    }

    /**
     * Moves to the next question.
     * (No changes needed in this function)
     */
    function nextQuestion() {
        if (currentComprehension && currentComprehension.questions && currentQuestionIndex < currentComprehension.questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        }
    }

    /**
     * Moves to the previous question.
     * (Added check for questions array existence)
     */
    function prevQuestion() {
         if (currentComprehension && currentComprehension.questions && currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    }

    /**
     * Applies the selected theme.
     * (No changes needed in this function)
     */
     function applyTheme(themeName) {
        // Ensure themeName is a string and potentially sanitize/validate it
        if (typeof themeName !== 'string' || !themeName.match(/^theme-[a-zA-Z0-9-]+$/)) {
            console.warn("Invalid theme name provided:", themeName);
            themeName = 'theme-default'; // Fallback to default
        }
        document.body.className = ''; // Remove existing theme classes
        document.body.classList.add(themeName);

        // Update active button state
        themeSwitcher.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });

        // Persist theme choice
        try {
            localStorage.setItem('comprehensionTheme', themeName);
        } catch (e) {
            console.warn("Could not save theme to localStorage:", e); // Handle potential storage errors (e.g., private browsing)
        }
     }

     /**
      * Loads the saved theme from localStorage or applies default.
      * (Added try-catch for localStorage access)
      */
     function loadTheme() {
        let savedTheme = 'theme-default'; // Default theme
        try {
            savedTheme = localStorage.getItem('comprehensionTheme') || 'theme-default';
        } catch (e) {
             console.warn("Could not read theme from localStorage:", e);
        }
        applyTheme(savedTheme);
     }

    // --- Event Listeners ---

    // Use event delegation for back buttons for slightly better performance
    appContainer.addEventListener('click', (event) => {
        const backButton = event.target.closest('.back-button'); // Find closest back button ancestor
        if (backButton && backButton.dataset.target) {
            switchView(backButton.dataset.target);
        }
    });

    // Start Questions Button
    startQuestionsButton.addEventListener('click', startQuestions);

    // Question Navigation Buttons
    showAnswerButton.addEventListener('click', showAnswer);
    nextQuestionButton.addEventListener('click', nextQuestion);
    prevQuestionButton.addEventListener('click', prevQuestion);
    finishButton.addEventListener('click', () => switchView('list-view')); // Go back to list on finish

    // Theme Switcher Buttons (using delegation)
    themeSwitcher.addEventListener('click', (event) => {
        const themeButton = event.target.closest('button[data-theme]');
        if (themeButton) {
            applyTheme(themeButton.dataset.theme);
        }
    });

     // Keyboard navigation for question buttons (example)
     questionView.addEventListener('keydown', (e) => {
        // Allow navigation even if answer isn't shown, using Tab/Shift+Tab is standard
        // This custom navigation might conflict with accessibility tools, use with caution.
        // Consider if standard Tab navigation is sufficient for the TV remote.

        // Example: Navigate between Prev/ShowAnswer/Next/Finish with arrows
        const focusableElements = [
            prevQuestionButton,
            showAnswerButton,
            nextQuestionButton,
            finishButton
        ].filter(el => el && !el.disabled && !el.classList.contains('hidden')); // Get visible, enabled buttons

        const currentFocusIndex = focusableElements.indexOf(document.activeElement);

        if (e.key === 'ArrowRight' && currentFocusIndex > -1 && currentFocusIndex < focusableElements.length - 1) {
            focusableElements[currentFocusIndex + 1].focus();
            e.preventDefault(); // Prevent default browser scroll
        } else if (e.key === 'ArrowLeft' && currentFocusIndex > 0) {
             focusableElements[currentFocusIndex - 1].focus();
             e.preventDefault(); // Prevent default browser scroll
        }

        // Activate focused button with Enter
         if (e.key === 'Enter' && document.activeElement && focusableElements.includes(document.activeElement)) {
             document.activeElement.click();
             e.preventDefault(); // Prevent potential form submission if inside one
         }
     });

     // Add keydown listener to list view for better keyboard nav
     listView.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const items = Array.from(listContainer.querySelectorAll('li[tabindex="0"]'));
            const currentFocus = document.activeElement;
            let currentFocusIndex = items.indexOf(currentFocus);

            if (currentFocusIndex === -1 && items.length > 0) {
                 items[0].focus(); // Focus first item if none is focused
                 e.preventDefault();
                 return;
            }

            if (e.key === 'ArrowDown' && currentFocusIndex < items.length - 1) {
                items[currentFocusIndex + 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowUp' && currentFocusIndex > 0) {
                items[currentFocusIndex - 1].focus();
                e.preventDefault();
            }
        }
        // Enter key handling is already on the list items themselves
     });


    // --- Initial Load ---
    loadTheme(); // Apply saved or default theme first
    loadAllData(); // Fetch data and populate the list

}); // End DOMContentLoaded
