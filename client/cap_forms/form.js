// --- 1. UPLOADER CONFIGURATION ---
// This initializes the uploader service.
try {
  $.uploader.init({
    apiKey: "public_W142i2G27rvDuqs2EeqkBiKNyYg3"
  });
} catch (e) {
  console.error("Uploader init failed. Is jQuery or uploader script missing?", e);
}


// --- 2. COMBINED DOM-READY SCRIPT ---
document.addEventListener('DOMContentLoaded', function() {

  // --- Uploader Initialization (Same as before) ---
  if (typeof $ === 'function' && typeof $.fn.uploader === 'function') {
    $("#dropzone").uploader({
      multi: true,
      layout: "inline",
      maxFileCount: 10,
      mimeTypes: ["image/jpeg", "image/png", "image/avif", "image/bmp", "image/gif", "image/tiff", "image/webp"],
      dropzone: { width: "100%", height: "200px" },
      editor: { images: { preview: false, crop: false } },
      path: {
        fileName: "{UTC_YEAR}-{UTC_MONTH}-{UTC_DAY}-{UNIQUE_DIGITS_10}{ORIGINAL_FILE_EXT}",
        folderPath: "/ebbett.co.nz/valuation/{UTC_YEAR}/{UTC_MONTH}/{UTC_DAY}"
      },
      styles: { colors: { primary: "#C4161C" } },
      onUpdate: files => {
        if (files.length === 0) {
          console.log('No files selected.');
        } else {
          console.log('Files uploaded:');
          console.log(files.map(f => f.fileUrl));
          $('#image-url').val(files.map(f => f.fileUrl));
          $('.progress-icon__thumbnail').css('background-image', 'url("https://uploads-ssl.webflow.com/60cabc68d06683dbd1f74006/64be434bc9190e8c5724d1d5_file-icon.svg")');
        }
      }
    });
  }

  // --- Form Section Elements ---
  const testDriveCheckbox = document.getElementById('test-drive-question');
  const testDriveAnswersDiv = document.getElementById('test-drive-answers');
  const tradeInCheckbox = document.getElementById('trade-in-question');
  const tradeInAnswersDiv = document.getElementById('trade-in-answers');

  // Elements for main section visibility
  const enquiryField = document.getElementById('field-enquiry');
  const testDriveSection = document.getElementById('test-drive-section');
  const tradeInSection = document.getElementById('trade-in-section');
  const testDriveQuestionWrapper = document.getElementById('test-drive-question-wrapper');
  
    // [CHANGE A: GLOBAL STATE VARIABLE]
    // Variable to store the initial enquiry value upon page load.
    let initialEnquiryValue = enquiryField ? enquiryField.value : '';


  // --- Logic for: #test-drive-section & #trade-in-section (Same as before) ---
  const allowedEnquiryValues = new Set([
    'new vehicle enquiry',
    'new vehicle test drive',
    'used vehicle enquiry',
    'used vehicle test drive',
    'demo vehicle enquiry',
    'demo vehicle test drive'
  ]);

  function updateSectionVisibility() {
    if (!enquiryField || !testDriveSection || !tradeInSection) {
      return; // Exit if elements aren't on this page
    }
    // Convert to lowercase for reliable checking against the Set
    const currentValue = enquiryField.value.toLowerCase();
    const isVisible = allowedEnquiryValues.has(currentValue);
    
    // Use '' to revert to CSS-defined display style
    testDriveSection.style.display = isVisible ? '' : 'none';
    tradeInSection.style.display = isVisible ? '' : 'none';
  }
  
    // [CHANGE B: UPDATED LOGIC FOR AUTO-CHECK AND HIDING THE QUESTION]
    function handleTestDriveDisplay() {
        if (!enquiryField || !testDriveCheckbox || !testDriveAnswersDiv || !testDriveQuestionWrapper) {
            return; // Exit if elements are missing
        }
        
        // Use lowercase for comparison
        const currentValue = enquiryField.value.toLowerCase(); 
        const initialValueLower = initialEnquiryValue.toLowerCase();

        const isForcedTestDriveType = [
            'new vehicle test drive',
            'used vehicle test drive',
            'demo vehicle test drive'
        ].includes(currentValue);
        
        // Determine if we should AUTO-HIDE the question:
        // This is true ONLY if the current enquiry value is one of the "test drive" types
        // AND the user has NOT changed the enquiry from its initial page-load value (case-insensitive check).
        const shouldAutoHideQuestion = isForcedTestDriveType && (currentValue === initialValueLower);


        if (isForcedTestDriveType) {
            // Since the user selected a Test Drive type, we must check the box and show the answers.
            testDriveCheckbox.checked = true;
            testDriveAnswersDiv.style.display = 'grid'; // Show the Date/Time pickers

            if (shouldAutoHideQuestion) {
                // If it's the INITIAL load state, hide the question wrapper.
                testDriveQuestionWrapper.style.display = 'none';
            } else {
                // If the user CHANGED the value, keep the question wrapper visible 
                // so they can uncheck it if needed.
                testDriveQuestionWrapper.style.display = '';
            }

        } else {
            // If the enquiry type is NOT an explicit test drive (e.g., 'enquiry', 'service')
            
            // 1. Show the question wrapper (allow user to manually check it)
            if (testDriveSection.style.display !== 'none') {
                testDriveQuestionWrapper.style.display = ''; 
            }

            // 2. Uncheck the box and hide the answers to reset the state 
            testDriveCheckbox.checked = false;
            testDriveAnswersDiv.style.display = 'none';
        }
    }


  // --- Logic for: Dynamic "wrapper-" fields (Updated to use enquiry options) ---
  function fieldvisibility() {
    // This function now *only* handles visibility, not GA4 tags.
    // Convert to lowercase right away for reliable checks
    var enquiryType = $("#field-enquiry").val().toLowerCase();

    // Reset all fields
    $(".field-hidden").attr("required", false).css("display", "none");
    $("#label-vehicle-service, #label-vehicle-sales").css("display", "none");

    // Check 1: Service
    // Updated check to include "service enquiry"
    if (enquiryType === "service" || enquiryType === "service enquiry") { 
      $(
        "#wrapper-date, #wrapper-rego, #wrapper-vehicle, #label-vehicle-service, #wrapper-service"
      ).css("display", "block");
      $("#field-vehicle").attr("required", false);
      $("#field-rego, #field-service").attr("required", true);
    // Check 2: Test Drives
    } else if (enquiryType === "new vehicle test drive" || enquiryType === "used vehicle test drive" || enquiryType === "demo vehicle test drive") {
      $("#wrapper-date, #wrapper-vehicle, #label-vehicle-sales").css(
        "display",
        "block"
      );
      $("#field-vehicle").attr("required", true);
      $("#field-rego, #field-service").attr("required", false);
      $("#wrapper-vehicle").css("grid-column", "1 / span 1");
    // Check 3: Enquiries (New, Used, Demo)
    } else if (enquiryType === "new vehicle enquiry" || enquiryType === "used vehicle enquiry" || enquiryType === "demo vehicle enquiry") {
      $("#wrapper-vehicle, #label-vehicle-sales").css("display", "block");
      $("#field-vehicle").attr("required", true);
      $("#field-rego, #field-service").attr("required", false);
      $("#wrapper-vehicle").css("grid-column", "1 / span 2");
    // Check 4: Finance
    // Updated check to use "finance enquiry"
    } else if (enquiryType === "finance" || enquiryType === "finance enquiry") {
      $("#wrapper-vehicle, #label-vehicle-service").css("display", "block");
      $("#field-vehicle").attr("required", true);
      $("#field-rego, #field-service").attr("required", false);
      $("#wrapper-vehicle").css("grid-column", "1 / span 2");
    // Check 5: Parts/Accessories
    // Updated check to use "parts enquiry" and "accessories enquiry"
    } else if (enquiryType === "parts" || enquiryType === "accessories" || enquiryType === "parts enquiry" || enquiryType === "accessories enquiry") {
      $("#wrapper-rego, #wrapper-vehicle, #label-vehicle-service").css(
        "display",
        "block"
      );
      $("#field-vehicle").attr("required", false);
      $("#field-rego, #field-service").attr("required", false);
    } else {
      // General enquiry, marketing enquiry, event response, etc.
    }
  }

  // --- Master Visibility Function ---
  // This runs both visibility checks at once
  function runAllVisibilityChecks() {
    fieldvisibility();
    updateSectionVisibility();
    handleTestDriveDisplay();
  }

  // --- INITIAL PAGE LOAD ---

    // NEW FIX: Hide #wrapper-rego immediately to prevent flicker on load.
    // It will be shown later by fieldvisibility() if the enquiry type matches "service", "parts", etc.
    $('#wrapper-rego').css('display', 'none'); 

  // 1. Set Dealership from URL param
  if (typeof getParam === 'function' && getParam("dealership") != "") {
    $("#field-dealership").val(getParam("dealership"));
    // We must trigger change for the global footer script to see it
    $("#field-dealership").trigger("change");
  }

  // 2. Hide inner answer divs on page load
  if (tradeInAnswersDiv) tradeInAnswersDiv.style.display = 'none';

  // 3. Set #field-enquiry based on pre-checked test-drive box
  // This block only runs on initial load.
  if (testDriveCheckbox && testDriveCheckbox.checked) {
    if (enquiryField) enquiryField.value = "new vehicle test drive";
    // IMPORTANT: Update initialEnquiryValue after setting it
    initialEnquiryValue = enquiryField ? enquiryField.value : '';
    // We trigger change so the global script can set GA4
    $(enquiryField).trigger("change");
  }
  
  // 4. Run all visibility checks to set the initial form state
  runAllVisibilityChecks();

  // --- EVENT LISTENERS ---

  // Listener for: #field-enquiry (the main dropdown)
  $("#field-enquiry").on("change", runAllVisibilityChecks);

  // Listener for: #test-drive-question checkbox (Updated for case-insensitivity)
  if (testDriveCheckbox) {
    testDriveCheckbox.addEventListener('change', function() {
      // 1. Show/hide inner test drive answers
      if (testDriveAnswersDiv) {
        testDriveAnswersDiv.style.display = this.checked ? 'grid' : 'none';
      }

      // 2. Handle Enquiry Field data (Use lowercase for local logic)
        const currentValue = enquiryField ? enquiryField.value.toLowerCase() : '';
        
        if (this.checked) {
            // Convert 'enquiry' to 'test drive' only if the current value is an 'enquiry' type
            if (currentValue.includes("enquiry") && enquiryField) {
                // Note: We update the actual field value with the correct case (assuming it's a dropdown option)
                // We assume the original value's casing is correct for the dropdown.
                const newEnquiryValue = enquiryField.value.replace(/enquiry/i, "test drive");
                enquiryField.value = newEnquiryValue;
            } else if (currentValue === "" && enquiryField) {
                 // If no value is set, default to new vehicle test drive
                 enquiryField.value = "new vehicle test drive";
            }
        } else {
            // Convert 'test drive' back to 'enquiry'
             if (currentValue.includes("test drive") && enquiryField) {
                // Update the actual field value with the correct case
                const newEnquiryValue = enquiryField.value.replace(/test drive/i, "enquiry");
                enquiryField.value = newEnquiryValue;
            }
        }
      
      // 3. Manually trigger the 'change' event on the enquiryField
      // This will run runAllVisibilityChecks() AND the global GA4 script
      $(enquiryField).trigger("change");
    });
  }

  // Listener for: #trade-in-question checkbox (inner div)
  if (tradeInCheckbox && tradeInAnswersDiv) {
    tradeInCheckbox.addEventListener('change', function() {
      tradeInAnswersDiv.style.display = this.checked ? 'grid' : 'none';
    });
  }

  // Listener for: #field-test-drive-date
  $('#field-test-drive-date').on('change', function() {
    if ($(this).val()) {
      const localEnquiryField = document.getElementById('field-enquiry');
      if (localEnquiryField) {
        // Use regex for case-insensitive replacement
        const enquiryValue = localEnquiryField.value;
        if (enquiryValue.toLowerCase().includes("enquiry")) {
          const newEnquiryValue = enquiryValue.replace(/enquiry/i, "test drive");
          localEnquiryField.value = newEnquiryValue;
          
          // CRITICAL: Trigger the change event to run all visibility logic
          // AND allow the global GA4 script to run
          $(localEnquiryField).trigger("change");
        }
      }
    }
  });

  // Listener for: [data-form-field-vehicle] clicks
  $('a[data-form-field-vehicle]').click(function() {
    var vehicleValue = $(this).attr('data-form-field-vehicle');
    $('#field-vehicle').val(vehicleValue);
    // Also trigger change event for the global GA4 script
    $('#field-vehicle').trigger('change');
  });

  // Listener for: [data-form-field-message] clicks
  $('a[data-form-field-message]').click(function() {
    var vehicleValue = $(this).attr('data-form-field-message');
    $('#field-message').val(vehicleValue);
  });
});
