$(document).ready(function () {
    $("[data-options-colours]").hide();
    $("[data-options-variable]").hide();
    $("[data-options-colours-button]").hide();
    $("[data-options-variable-button]").hide();

    var selectedUrl = '';
    var selectedUrl2 = '';

    $("[data-options-variant]").on("click", function () {
        $("[data-options-variant]").removeAttr('style');
        $(this).css({
            "background-color": "var(--colours--ebbett-grey)",
            "color": "white"
        });

        // Clear data-options-container-variable when a variant is clicked
        $("[data-options-container-variable]").empty();

        var coloursContent = $(this).siblings("[data-options-colours]").clone();
        $("[data-options-container-colours]").html(coloursContent);
        $("[data-options-container-colours] [data-options-colours]").css('display', 'flex');
    });

    // Use event delegation for dynamically added elements
    $(document).on("click", "[data-options-container-colours] [data-options-url]", function () {
        selectedUrl = $(this).attr('data-options-url');
        selectedUrl2 = $(this).attr('data-options-url2');

        // Reset styles for all data-options-url and data-options-url2 elements
        $("[data-options-container-colours] [data-options-url]").css({
            "opacity": '0.5',
            "border-color": "white"
        });

        // Apply selected style to the clicked element
        $(this).css({
            "opacity": '1',
            "border-color": "var(--colours--ebbett-grey)"
        });

        if (selectedUrl2 && selectedUrl2 !== '') {
            // Clear the container before adding new content
            $("[data-options-container-variable]").empty();

            // Clone and add the new content
            var variableContent = $(this).closest('.build-your-deal_modal-container').find("[data-options-variable]").clone();
            $("[data-options-container-variable]").html(variableContent);
            $("[data-options-container-variable] [data-options-variable]").css('display', 'flex');
            $("[data-options-colours-button]").hide();
        } else {
            $("[data-options-container-variable]").empty();
            $("[data-options-colours-button]").attr('href', selectedUrl).show();
        }
    });

    // Handle clicks on the variable options
    $(document).on("click", "[data-variable]", function () {
        var variableType = $(this).attr('data-variable');

        // Reset styles for all data-variable elements
        $("[data-variable]").css({
            "opacity": '0.5',
            "border-color": "white"
        });

        // Apply selected style to the clicked data-variable element
        $(this).css({
            "opacity": '1',
            "border-color": "var(--colours--ebbett-grey)"
        });

        if (variableType == 1) {
            $("[data-options-variable-button]").attr('href', selectedUrl).show();
        } else if (variableType == 2 && selectedUrl2 && selectedUrl2 !== '') {
            $("[data-options-variable-button]").attr('href', selectedUrl2).show();
        }
    });

});




$(document).ready(function () {
    //Offers section, count and tab    
    var count = $('[data-offer="item"]').length;

    if (count >= 1) {
        $('[data-offer="section"]').css('display', 'block');
        $('[data-offer="tab"]').css('display', 'flex');
        $('[data-offer="count"]').text(1 + ' Offer Available');
        $('.button.is-offer-tab').text('View Offer');
        if (count >= 2) {
            $('[data-offer="count"]').text(count + ' Offers Available');
            $('.button.is-offer-tab').text('View Offers');
        }
    } else {
        $('[data-offer="section"]').css('display', 'none');
        $('[data-offer="tab"]').css('display', 'none');
    }

    function moveTabElement() {
        var windowWidth = $(window).width();
        if (windowWidth < 992) {
            $('[data-offer="tab"]').prependTo('[data-offer="tablet-container"]');
        } else {
            $('[data-offer="tab"]').prependTo('[data-offer="desktop-container"]');
        }
    }

    moveTabElement();
    $(window).resize(moveTabElement);

    //Change dealership field value if only one dealership for this brand
    if ($('[data-select2="item"]').length === 1) {
        var dealershipText = $('[data-select2="dealership"]').text().trim();

        var matchingOptionValue = $('#field-dealership option').filter(function () {
            return $(this).text().trim() === dealershipText;
        }).val();

        if (matchingOptionValue) {
            $('#field-dealership').val(matchingOptionValue).trigger('change');
        }
    }
});

//Video Slider Script

$(document).ready(function() {   
    $('#model-video-desktop').on('click', function() {
        if (this.requestFullscreen) {
            this.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            alert("Fullscreen API is not supported by your browser.");
        }
    });

    $('.splide__arrow').on('click', function() {
        var $video = $(this).closest('.splide').find('video[data-splide="video-element"]');
        if ($video.length) {
            $video.prop('muted', true);
        } else {
            console.log("No video found associated with this arrow.");
        }
    });

});

$(document).ready(function() {
    $('#model-video-mobile').on('click', function() {
        if (/android/i.test(navigator.userAgent)) {
            console.log('Android device detected - Fullscreen feature disabled.');
            return;
        }

        var videoElement = this;

        if (videoElement.requestFullscreen) {
            if (!document.fullscreenElement) {
                videoElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            } else {
                document.exitFullscreen().catch(err => {
                    console.error(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
                });
            }
        } else if (videoElement.webkitEnterFullscreen) { 
            videoElement.webkitEnterFullscreen(); 
        } else {
            console.log('Fullscreen API is not supported by your browser.');
        }
    }); 
}); 

$(document).ready(function() {
    if ($('[data-select2="item"]').length === 1) {
        $('#wrapper-dealership').remove();
  
        var dealershipName = $('[data-select2="item"]').find('[data-select2="dealership"]').text();
  
        var hiddenInput = $('<input>').attr({
            type: 'hidden',
            id: 'field-dealership',
            name: 'Dealership',
            value: dealershipName
        });
  
        $('[data-ga4tracking-type="form"]').attr('data-ga4-param-dealership', dealershipName);
  
        $('#form-html-embed').append(hiddenInput);
    }
  });
  
  
// Change enquiry type if test drive is checked.
const testDriveCheckbox = document.getElementById('test-drive-question');

testDriveCheckbox.addEventListener('change', function() {
  const enquiryField = document.getElementById('field-enquiry');
  const formElements = document.querySelectorAll('[data-ga4-param-enquiry="new vehicle enquiry"]');
  
  if (this.checked) {
    enquiryField.value = "new vehicle test drive";
    formElements.forEach(element => {
      element.setAttribute('data-ga4-param-enquiry', 'new vehicle test drive');
    });
  } else {
    enquiryField.value = "new vehicle enquiry";
    formElements.forEach(element => {
      element.setAttribute('data-ga4-param-enquiry', 'new vehicle enquiry');
    });
  }
});


if (testDriveCheckbox.checked) {
  const enquiryField = document.getElementById('field-enquiry');
  enquiryField.value = "new vehicle test drive";
  
  const formElements = document.querySelectorAll('[data-ga4-param-enquiry="new vehicle enquiry"]');
  formElements.forEach(element => {
    element.setAttribute('data-ga4-param-enquiry', 'new vehicle test drive');
  });
}