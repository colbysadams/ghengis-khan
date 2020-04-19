/**
 * CSS to hide everything on the page,
 * except for elements that have the "beastify-image" class.
 */
const hidePage = `body > :not(.beastify-image) {
                    display: none;
                  }`;

/**
 * Listen for clicks on the buttons, and send the appropriate message to
 * the content script in the page.
 */
function listenForClicks() {
  document.addEventListener("click", (e) => {
    /**
     * Given the name of a beast, get the URL to the corresponding image.
     */
    function sendMessage(buttonText) {
      switch (buttonText) {
        case "download":
          const startDate = document.querySelector("#start_date").value;
          const endDate = document.querySelector("#end_date").value;
          if (!startDate || !endDate) {
            alert("start and end dates are required...");
          } else {
            if (document.querySelector("#activities").checked) {
              browser.runtime.sendMessage({
                command: "activities",
                startDate,
                endDate,
              });
            }

            if (document.querySelector("#assignments").checked) {
              browser.runtime.sendMessage({
                command: "assignments",
                startDate,
                endDate,
              });
            }
          }
      }
    }

    sendMessage(e.target.id);
  });
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function backgroundLoadedSuccessfully() {
  document.querySelector("#popup-content").classList.remove("hidden");
  document.querySelector("#error-content").classList.add("hidden");
}

/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */

function handleResponse(message) {
  console.log(`background script sent a response: ${message.isReady}`);
}

function handleError(error) {
  console.log(`Error: ${error}`);
}

(async function () {
  function waitUntilReady({ isReady = false }) {
    console.log("waiting for background script...");
    if (!isReady) {
      setTimeout(function () {
        const sending = browser.runtime.sendMessage({ command: "ready-query" });
        sending.then(waitUntilReady, handleError);
      }, 250);
    } else {
      console.log("background script ready!");
      backgroundLoadedSuccessfully();
      listenForClicks();
    }
  }

  waitUntilReady({ isReady: false });
})();
