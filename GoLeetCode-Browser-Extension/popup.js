const PROXY_SERVER_URL = "http://localhost:3000";

let currentLeetCodeProblemSlug = null;

document.addEventListener("DOMContentLoaded", () => {
  const questionInput = document.getElementById("questionInput");
  const sendMessageButton = document.getElementById("sendMessageButton");
  const responseContainer = document.getElementById("response-container");
  const activityIndicatorArea = document.getElementById(
    "activity-indicator-area"
  );
  const problemNameDisplay = document.getElementById("problemNameDisplay");

  if (
    !questionInput ||
    !sendMessageButton ||
    !responseContainer ||
    !activityIndicatorArea ||
    !problemNameDisplay
  ) {
    console.error("Required DOM elements not found. Check popup.html.");
    return;
  }

  sendMessageButton.addEventListener("click", () => {
    sendMessage(null);
  });

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(null);
    }
  });

  loadProblemFromCurrentTab();

  async function loadProblemFromCurrentTab() {
    showActivityIndicator();
    questionInput.placeholder = "Please wait...";
    questionInput.disabled = true;
    problemNameDisplay.textContent = "Detecting LeetCode problem...";

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTabUrl = tabs[0].url;

      const detectedSlug = getLeetCodeProblemSlug(currentTabUrl);

      if (detectedSlug) {
        currentLeetCodeProblemSlug = detectedSlug;
        // --- MODIFIED LINE HERE ---
        problemNameDisplay.textContent = `Problem: ${formatSlugToProblemName(
          detectedSlug
        )}`;

        await sendMessage(currentLeetCodeProblemSlug, true);
        questionInput.placeholder = `Follow-up on "${currentLeetCodeProblemSlug}" or ask a new question...`;
        questionInput.focus();
      } else {
        hideActivityIndicator();
        responseContainer.innerHTML =
          '<p>Please navigate to a LeetCode problem page (e.g., <a href="https://leetcode.com/problems/two-sum/" target="_blank">example</a>) to get an automatic hint, or type your question below.</p>';
        questionInput.placeholder = "Type your LeetCode question here...";
        problemNameDisplay.textContent = "No LeetCode problem detected.";
      }
    } catch (error) {
      console.error(
        "Error getting current tab URL or sending initial question:",
        error
      );
      hideActivityIndicator();
      responseContainer.innerHTML =
        '<p style="color: red;">Error detecting problem or sending initial request. Please try typing a question.</p>';
      questionInput.placeholder = "Type your LeetCode question here...";
      problemNameDisplay.textContent = "Error detecting problem.";
    } finally {
      questionInput.disabled = false;
    }
  }

  async function sendMessage(questionOverride, isInitialLoad = false) {
    let userQuestion;

    if (questionOverride !== null) {
      userQuestion = questionOverride;
    } else {
      userQuestion = questionInput.value.trim();
    }

    if (!userQuestion) {
      responseContainer.innerHTML =
        '<p style="color: red;">Please type a question before sending.</p>';
      return;
    }

    if (!isInitialLoad) {
      responseContainer.innerHTML = "";
    }
    showActivityIndicator();
    questionInput.disabled = true;
    sendMessageButton.disabled = true;

    let combinedQuestion = userQuestion;
    if (
      currentLeetCodeProblemSlug &&
      !userQuestion
        .toLowerCase()
        .includes(currentLeetCodeProblemSlug.toLowerCase())
    ) {
      combinedQuestion = `Regarding LeetCode problem "${currentLeetCodeProblemSlug}": ${userQuestion}`;
    }

    try {
      const response = await fetch(`${PROXY_SERVER_URL}/ask-leetcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: combinedQuestion }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${
            errorData.error || "Unknown error from proxy"
          }`
        );
      }

      const data = await response.json();
      const formattedResponse = formatBotResponse(data.response);
      responseContainer.innerHTML = `<p>${formattedResponse}</p>`;

      if (!isInitialLoad) {
        questionInput.value = "";
      }
    } catch (error) {
      console.error("Error:", error);
      responseContainer.innerHTML = `<p style="color: red;">Failed to get a response. Please try again. Error: ${
        error.message || "Check console for details."
      }</p>`;
    } finally {
      hideActivityIndicator();
      questionInput.disabled = false;
      sendMessageButton.disabled = false;
    }
  }

  function getLeetCodeProblemSlug(url) {
    const problemPath = "/problems/";

    if (url && url.startsWith("https://leetcode.com/")) {
      const problemsIndex = url.indexOf(problemPath);

      if (problemsIndex > -1) {
        const slugStartIndex = problemsIndex + problemPath.length;
        const nextSlashIndex = url.indexOf("/", slugStartIndex);

        let slug;
        if (nextSlashIndex > -1) {
          slug = url.substring(slugStartIndex, nextSlashIndex);
        } else {
          slug = url.substring(slugStartIndex);
        }

        if (slug && slug.trim().length > 0) {
          return slug.trim();
        }
      }
    }
    return null;
  }

  function formatSlugToProblemName(slug) {
    if (!slug) return "";
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function formatBotResponse(text) {
    let formattedText = text.replace(/`([^`]+)`/g, "<em>$1</em>");
    formattedText = formattedText.replace(
      /\*\*([^*]+)\*\*/g,
      "<strong>$1</strong>"
    );
    return formattedText;
  }

  function showActivityIndicator() {
    activityIndicatorArea.innerHTML = `
            <div class="loading-indicator">
                <div class="dot-pulse"></div>
                <div class="dot-pulse"></div>
                <div class="dot-pulse"></div>
            </div>
        `;
    responseContainer.style.display = "none";
  }

  function hideActivityIndicator() {
    activityIndicatorArea.innerHTML = "";
    responseContainer.style.display = "block";
  }
});
