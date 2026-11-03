function moveVideoSlide() {
    var $containers = $('[data-splide="video-container"]');
    if ($containers.length === 0) {
        return;
    }
    $containers.each(function() {
        var $videoContainer = $(this);
        $videoContainer.css('display', 'flex');
        var $list = $videoContainer.siblings('.splide__track').find('.splide__list');
        if ($list.length) {
            $list.prepend($videoContainer);
        }
    });
}

moveVideoSlide();
